import { AppError } from "@src/lib/utils/api-utils";
import { UNVERSIONED } from "@src/lib/client-version";

/**
 * Which app builds call the API, for the admin overview. Read from the Prometheus that
 * scrapes this app rather than counted again, so the numbers match the Grafana dashboard.
 * These are signed-in requests, not people: one busy user weighs more than many occasional ones.
 */

/** Prometheus keeps 30 days (docker-compose.yml), so no range reaches further back. */
export const USAGE_RANGES = ["24h", "7d", "30d"] as const;
export type UsageRange = (typeof USAGE_RANGES)[number];

export type BuildUsage = { platform: string; version: string; requests: number };

type InstantQueryResponse = {
    status: "success" | "error";
    error?: string;
    data?: { result: { metric: Record<string, string>; value: [number, string] }[] };
};

export async function getBuildUsage(range: UsageRange): Promise<BuildUsage[]> {
    const base = process.env.PROMETHEUS_URL;
    if (!base) {
        throw new AppError(503, "Build usage is read from Prometheus, which only runs in production.");
    }

    const query = `sum by (platform, version) (increase(http_client_requests_total[${range}]))`;
    let body: InstantQueryResponse;
    try {
        const res = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(query)}`, {
            signal: AbortSignal.timeout(5000),
        });
        body = (await res.json()) as InstantQueryResponse;
    } catch {
        throw new AppError(502, "Prometheus could not be reached.");
    }
    if (body.status !== "success" || !body.data) {
        throw new AppError(502, `Prometheus refused the query: ${body.error ?? "unknown error"}`);
    }

    // increase() extrapolates across scrapes, so its counts come back fractional.
    return body.data.result
        .map(({ metric, value }) => ({
            platform: metric.platform ?? "unknown",
            version: metric.version ?? UNVERSIONED,
            requests: Math.round(Number(value[1])),
        }))
        .filter((row) => row.requests > 0);
}
