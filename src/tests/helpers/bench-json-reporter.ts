/**
 * Custom Vitest benchmark reporter that writes results to bench-results.json.
 * Uses onTestRunEnd to walk the finished test modules and read the benchmark
 * data each task carries.
 */
import { BenchmarkReporter } from "vitest/node";
import type { Reporter } from "vitest/node";
import type { RunnerTask } from "vitest";
import { writeFileSync } from "node:fs";

interface BenchEntry {
    name: string;
    suite: string;
    browser: string;
    hz: number;
    /** milliseconds per operation */
    meanMs: number;
    minMs: number;
    maxMs: number;
    p75Ms: number;
    p99Ms: number;
    rme: number;
    samples: number;
}

type TaskWithChildren = RunnerTask & { tasks?: RunnerTask[] };

export default class BenchJsonReporter extends BenchmarkReporter {
    private collectEntries(tasks: RunnerTask[], suitePath: string, browser: string, entries: BenchEntry[]) {
        for (const task of tasks) {
            const sub = (task as TaskWithChildren).tasks;
            if (sub?.length) {
                const childPath = suitePath ? `${suitePath} > ${task.name}` : task.name;
                this.collectEntries(sub, childPath, browser, entries);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bm = (task.result as any)?.benchmark;
            if (!bm || typeof bm.hz !== "number") continue;

            entries.push({
                name: task.name,
                suite: suitePath,
                browser,
                hz: bm.hz,
                meanMs: bm.mean,
                minMs: bm.min,
                maxMs: bm.max,
                p75Ms: bm.p75,
                p99Ms: bm.p99,
                rme: bm.rme,
                samples: Array.isArray(bm.samples) ? bm.samples.length : (bm.sampleCount ?? 0),
            });
        }
    }

    async onTestRunEnd(...args: Parameters<NonNullable<Reporter["onTestRunEnd"]>>) {
        await super.onTestRunEnd(...args);

        const [testModules] = args;
        const entries: BenchEntry[] = [];
        for (const testModule of testModules) {
            // The benchmark data is only reachable through the runner task, which TestModule's types don't expose.
            const { tasks } = (testModule as unknown as { task: { tasks: RunnerTask[] } }).task;
            this.collectEntries(tasks, "", testModule.project.name, entries);
        }
        if (entries.length === 0) return;

        const grouped: Record<string, BenchEntry[]> = {};
        for (const entry of entries) {
            const key = `[${entry.browser}] ${entry.suite}`;
            (grouped[key] ??= []).push(entry);
        }

        writeFileSync(
            "bench-results.json",
            JSON.stringify({ generated: new Date().toISOString(), grouped }, null, 2),
            "utf-8",
        );
        console.log(`\nBench results written to bench-results.json (${entries.length} entries)`);
    }
}
