"use client";

import { useState } from "react";
import useSWR from "swr";
import { ExternalLink } from "lucide-react";
import { compareVersions, isVersion, OTHER_VERSIONS, UNVERSIONED } from "@src/lib/client-version";
import styles from "./BuildUsage.module.css";

type Range = "24h" | "7d" | "30d";
type Row = { platform: string; version: string; requests: number };
type Usage = { range: Range; rows: Row[] };

const RANGES: { value: Range; label: string }[] = [
    { value: "24h", label: "24 hours" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
];

const GRAFANA_URL = "https://monitoring.scenarly.com/d/scenarly-overview";

const PLATFORM_LABELS: Record<string, string> = {
    web: "Web",
    ios: "iOS",
    macos: "macOS",
    android: "Android",
    windows: "Windows",
    linux: "Linux",
    unknown: "Unknown",
};

const platformLabel = (platform: string) => PLATFORM_LABELS[platform] ?? platform;

const share = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "–");

/** Labels that stand for no single version. */
const UNNAMED_VERSIONS: Record<string, string> = {
    [UNVERSIONED]: "Older build, no version",
    [OTHER_VERSIONS]: "Not a released version",
};

/** Newest first; rows that stand for no single version come last. */
const byVersionDesc = (a: Row, b: Row) => {
    if (!isVersion(a.version) || !isVersion(b.version)) {
        return Number(!isVersion(a.version)) - Number(!isVersion(b.version));
    }
    return compareVersions(b.version, a.version);
};

export default function BuildUsage() {
    const [range, setRange] = useState<Range>("7d");
    const { data, error, isLoading } = useSWR<Usage>(`/api/admin/build-usage?range=${range}`, {
        shouldRetryOnError: false,
    });

    const rows = data?.rows ?? [];
    const platformTotals = new Map<string, number>();
    for (const row of rows) {
        platformTotals.set(row.platform, (platformTotals.get(row.platform) ?? 0) + row.requests);
    }
    const total = rows.reduce((sum, row) => sum + row.requests, 0);
    const platforms = [...platformTotals].sort((a, b) => b[1] - a[1]);
    const versions = [...rows].sort(
        (a, b) =>
            platformTotals.get(b.platform)! - platformTotals.get(a.platform)! ||
            a.platform.localeCompare(b.platform) ||
            byVersionDesc(a, b),
    );

    const status = isLoading ? (
        <div className={styles.emptyRow}>Loading…</div>
    ) : error ? (
        <div className={`${styles.emptyRow} ${styles.error}`}>{error.message ?? "Failed to load build usage."}</div>
    ) : rows.length === 0 ? (
        <div className={styles.emptyRow}>No requests in this range.</div>
    ) : null;

    return (
        <section className={styles.card}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.cardTitle}>App builds</h2>
                    <span className={styles.hint}>Signed-in API requests by platform and version. Requests, not people.</span>
                </div>
                <div className={styles.actions}>
                    <div className={styles.ranges} role="group" aria-label="Range">
                        {RANGES.map((r) => (
                            <button
                                key={r.value}
                                type="button"
                                className={`${styles.range} ${r.value === range ? styles.rangeActive : ""}`}
                                aria-pressed={r.value === range}
                                onClick={() => setRange(r.value)}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <a href={GRAFANA_URL} target="_blank" rel="noreferrer" className={styles.grafanaLink}>
                        Grafana
                        <ExternalLink size={13} />
                    </a>
                </div>
            </div>

            <div className={styles.tables}>
                <div className={styles.table}>
                    <div className={`${styles.tableRow} ${styles.platformRow} ${styles.tableHeader}`}>
                        <span>Platform</span>
                        <span className={styles.number}>Requests</span>
                        <span className={styles.number}>Share</span>
                    </div>
                    {status}
                    {!status &&
                        platforms.map(([platform, requests]) => (
                            <div key={platform} className={`${styles.tableRow} ${styles.platformRow}`}>
                                <span>{platformLabel(platform)}</span>
                                <span className={styles.number}>{requests.toLocaleString()}</span>
                                <span className={`${styles.number} ${styles.muted}`}>{share(requests, total)}</span>
                            </div>
                        ))}
                </div>

                <div className={styles.table}>
                    <div className={`${styles.tableRow} ${styles.versionRow} ${styles.tableHeader}`}>
                        <span>Platform</span>
                        <span>Version</span>
                        <span className={styles.number}>Requests</span>
                        <span className={styles.number}>Of platform</span>
                    </div>
                    {status}
                    {!status &&
                        versions.map((row) => (
                            <div key={`${row.platform} ${row.version}`} className={`${styles.tableRow} ${styles.versionRow}`}>
                                <span>{platformLabel(row.platform)}</span>
                                <span className={row.version in UNNAMED_VERSIONS ? styles.muted : undefined}>
                                    {UNNAMED_VERSIONS[row.version] ?? row.version}
                                </span>
                                <span className={styles.number}>{row.requests.toLocaleString()}</span>
                                <span className={`${styles.number} ${styles.muted}`}>
                                    {share(row.requests, platformTotals.get(row.platform)!)}
                                </span>
                            </div>
                        ))}
                </div>
            </div>
        </section>
    );
}
