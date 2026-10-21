// Fails when a production dependency has a high or critical advisory that is
// not accepted in scripts/audit-allowlist.json. Run by the release and staging
// workflows before anything is built or published.
//
// Runs on plain Node (built-in type stripping), with no `npm ci`: npm audit
// only needs the lockfile, and the gate passes before any install script runs.
// Keep it to erasable TypeScript: types and interfaces, no enums or namespaces.
//
//   node scripts/audit-gate.ts

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Severity = "info" | "low" | "moderate" | "high" | "critical";

interface AllowlistEntry {
    advisories: string[];
    paths: string[];
    reason: string;
    /** ISO date (YYYY-MM-DD) after which the entry no longer applies. */
    expires: string;
}

/** The parts of `npm audit --json` (lockfile v2+ report) the gate reads. */
interface Advisory {
    title: string;
    url: string;
    severity: Severity;
}

interface Vulnerability {
    name: string;
    /** An advisory, or the name of a vulnerable dependency reported on its own entry. */
    via: (Advisory | string)[];
    /** Install paths, e.g. `node_modules/a/node_modules/b`. */
    nodes: string[];
}

interface AuditReport {
    vulnerabilities?: Record<string, Vulnerability>;
    error?: { summary?: string; detail?: string };
}

interface Finding {
    id: string;
    severity: Severity;
    path: string;
    title: string;
}

const BLOCKING = new Set<Severity>(["high", "critical"]);

const allowlist: AllowlistEntry[] = JSON.parse(
    readFileSync(new URL("./audit-allowlist.json", import.meta.url), "utf8"),
).entries;

// `npm audit` exits non-zero whenever it finds anything, so read its output
// from the error as well.
let raw: string;
try {
    raw = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
    raw = (err as { stdout?: string }).stdout ?? "";
}
// Fail closed: nothing ships on an audit that didn't complete.
let report: AuditReport;
try {
    report = JSON.parse(raw);
} catch {
    report = { error: { summary: raw || "no output" } };
}
if (report.error) {
    const reason = report.error.summary || report.error.detail || JSON.stringify(report.error);
    console.error(`npm audit did not complete: ${reason}`);
    console.error("Re-run the workflow once the npm registry is reachable.");
    process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const blocking: Finding[] = [];
const accepted: Finding[] = [];
const expired = new Set<AllowlistEntry>();
const seen = new Set<string>();

for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const advisory of vuln.via) {
        if (typeof advisory === "string" || !BLOCKING.has(advisory.severity)) continue;
        const id = advisory.url.split("/").pop() ?? advisory.url;

        for (const path of vuln.nodes) {
            // npm lists one advisory once per affected version range.
            if (seen.has(`${id} ${path}`)) continue;
            seen.add(`${id} ${path}`);
            const finding: Finding = { id, severity: advisory.severity, path, title: advisory.title };
            const entry = allowlist.find((e) => e.advisories.includes(id) && e.paths.includes(path));
            if (entry && entry.expires >= today) accepted.push(finding);
            else {
                if (entry) expired.add(entry);
                blocking.push(finding);
            }
        }
    }
}

const line = (f: Finding) => `  ${f.severity.toUpperCase().padEnd(8)} ${f.id}  ${f.path}\n           ${f.title}`;

if (accepted.length) {
    console.log(`Accepted by scripts/audit-allowlist.json (${accepted.length}):`);
    accepted.forEach((f) => console.log(line(f)));
}
if (blocking.length) {
    const plural = blocking.length === 1 ? "advisory" : "advisories";
    console.error(`\nBlocking: ${blocking.length} high/critical ${plural} in production dependencies:`);
    blocking.forEach((f) => console.error(line(f)));
    for (const e of expired) console.error(`\nAllowlist entry for ${e.advisories.join(", ")} expired on ${e.expires}.`);
    console.error("\nUpdate the dependency (npm audit fix), or accept it in scripts/audit-allowlist.json with a reason and an expiry date.");
    process.exit(1);
}
console.log("\nNo blocking advisories in production dependencies.");
