import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import BenchJsonReporter from "./src/tests/helpers/bench-json-reporter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        browser: {
            enabled: true,
            provider: "playwright",
            instances: [
                { browser: "chromium", headless: true },
                { browser: "webkit", headless: true },
            ],
        },
        setupFiles: ["./src/tests/setup.ts"],
        // The revision suites wait on a wall-clock debounce and flake under load;
        // one retry in CI absorbs that, a real regression fails both attempts.
        retry: process.env.CI ? 1 : 0,
        benchmark: {
            include: ["src/tests/benchmarks/**/*.bench.ts"],
            reporters: [new BenchJsonReporter()],
        },
    },
    resolve: {
        alias: {
            // mirrors tsconfig "@*": ["./*"] — Next.js webpack handles this automatically
            "@src": path.resolve(__dirname, "./src"),
            "@node_modules": path.resolve(__dirname, "./node_modules"),
        },
    },
});
