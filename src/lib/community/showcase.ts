/**
 * Showcase rules shared by the API, the server-rendered pages and the tests:
 * the ranking score, the slug, which kind a submission may be shown as, and
 * how the wall's query string is read. Pure — no I/O.
 */

import type { CommunityFormat, CommunityShowcaseKind } from "@src/generated/client/browser";
import { SHOWCASE_GRAVITY } from "./constants";

export type ShowcaseSort = "top" | "new";

export const SHOWCASE_KINDS: CommunityShowcaseKind[] = ["FULL_SCRIPT", "PILOT", "SHORT", "LOGLINE"];

/**
 * Top-sort score of an entry. The repository orders by the same expression in
 * SQL; keep the two in step. Age is clamped at zero so a clock skew between
 * the app and the database never produces a negative base.
 */
export function showcaseScore(upvotes: number, publishedAt: Date, now: Date): number {
    const hours = Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000);
    return (upvotes + 1) / Math.pow(hours + 2, SHOWCASE_GRAVITY);
}

/** Lowercase ASCII words joined by dashes; accents are folded, everything else dropped. */
export function slugify(text: string): string {
    return text
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/, "");
}

/** URL segment of an entry: the title slug plus the last 6 id characters, which keep it unique. */
export function showcaseSlug(title: string, submissionId: string): string {
    const base = slugify(title);
    const suffix = submissionId.slice(-6).toLowerCase();
    return base ? `${base}-${suffix}` : suffix;
}

/** The kind that shows a submission's PDF, by its format. */
export const FULL_KIND_BY_FORMAT: Record<CommunityFormat, CommunityShowcaseKind> = {
    FEATURE: "FULL_SCRIPT",
    PILOT: "PILOT",
    SHORT: "SHORT",
    OTHER: "FULL_SCRIPT",
};

/**
 * Kinds a submission may be published as: its PDF under the kind matching its
 * format, or the logline alone. A feature is never listed as a pilot.
 */
export const showcaseKindsFor = (format: CommunityFormat): CommunityShowcaseKind[] => [
    FULL_KIND_BY_FORMAT[format],
    "LOGLINE",
];

export const showsPdf = (kind: CommunityShowcaseKind) => kind !== "LOGLINE";

/** `?kind=` values: readable in a URL, one per kind. */
export const KIND_PARAM: Record<CommunityShowcaseKind, string> = {
    FULL_SCRIPT: "full-script",
    PILOT: "pilot",
    SHORT: "short",
    LOGLINE: "logline",
};

const KIND_BY_PARAM = Object.fromEntries(
    Object.entries(KIND_PARAM).map(([kind, param]) => [param, kind as CommunityShowcaseKind]),
);

export interface ShowcaseQuery {
    sort: ShowcaseSort;
    kind: CommunityShowcaseKind | null;
    /** 1-based. */
    page: number;
}

/**
 * Read the wall's query string leniently: anything unknown falls back to the
 * default (Top, every kind, page 1) instead of failing, since these URLs are
 * crawled and shared.
 */
export function parseShowcaseQuery(params: Record<string, string | string[] | undefined>): ShowcaseQuery {
    const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    const page = Number.parseInt(one(params.page) ?? "", 10);
    return {
        sort: one(params.sort) === "new" ? "new" : "top",
        kind: KIND_BY_PARAM[one(params.kind) ?? ""] ?? null,
        page: Number.isFinite(page) && page > 1 ? page : 1,
    };
}

/** The wall URL for a query, omitting defaults so the canonical URL is `/community/showcase`. */
export function showcaseHref(query: Partial<ShowcaseQuery>): string {
    const params = new URLSearchParams();
    if (query.sort === "new") params.set("sort", "new");
    if (query.kind) params.set("kind", KIND_PARAM[query.kind]);
    if (query.page && query.page > 1) params.set("page", String(query.page));
    const qs = params.toString();
    return qs ? `/community/showcase?${qs}` : "/community/showcase";
}
