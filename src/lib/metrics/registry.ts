import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

type MetricsBundle = {
    registry: Registry;
    httpRequestsTotal: Counter<"method" | "route" | "status">;
    httpRequestDurationSeconds: Histogram<"method" | "route" | "status">;
    httpClientRequestsTotal: Counter<"platform" | "version">;
    dbSizeBytes: Gauge<string>;
};

declare global {
    var __scenarly_metrics__: MetricsBundle | undefined;
}

const buildMetrics = (): MetricsBundle => {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });

    const httpRequestsTotal = new Counter({
        name: "http_requests_total",
        help: "Total HTTP requests handled by apiHandler.",
        labelNames: ["method", "route", "status"] as const,
        registers: [registry],
    });

    const httpRequestDurationSeconds = new Histogram({
        name: "http_request_duration_seconds",
        help: "HTTP request latency in seconds.",
        labelNames: ["method", "route", "status"] as const,
        registers: [registry],
    });

    // Labels come from request headers, so only values client-version accepts
    // are used: anything else is "unknown" or "unversioned", and a version
    // that was never released is "other".
    const httpClientRequestsTotal = new Counter({
        name: "http_client_requests_total",
        help: "Signed-in API requests by the platform and version of the app build that sent them.",
        labelNames: ["platform", "version"] as const,
        registers: [registry],
    });

    const dbSizeBytes = new Gauge({
        name: "scenarly_db_size_bytes",
        help: "Current size of the application database in bytes.",
        registers: [registry],
    });

    return { registry, httpRequestsTotal, httpRequestDurationSeconds, httpClientRequestsTotal, dbSizeBytes };
};

const metrics = globalThis.__scenarly_metrics__ ?? buildMetrics();

if (process.env.NODE_ENV !== "production") globalThis.__scenarly_metrics__ = metrics;

export const { registry, httpRequestsTotal, httpRequestDurationSeconds, httpClientRequestsTotal, dbSizeBytes } =
    metrics;
