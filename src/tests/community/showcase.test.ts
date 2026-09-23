import { describe, it, expect } from "vitest";

import {
    parseShowcaseQuery,
    showcaseHref,
    showcaseKindsFor,
    showcaseScore,
    showcaseSlug,
    slugify,
} from "@src/lib/community/showcase";
import { applyUpvote, type UpvoteTx } from "@src/server/service/community-upvote";
import { SHOWCASE_GRAVITY } from "@src/lib/community/constants";

const HOUR = 3_600_000;
const now = new Date("2026-09-23T12:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

/** Rank like the repository's `ORDER BY score DESC, publishedAt DESC`. */
const rank = (entries: { id: string; upvotes: number; publishedAt: Date }[]) =>
    [...entries]
        .sort(
            (a, b) =>
                showcaseScore(b.upvotes, b.publishedAt, now) - showcaseScore(a.upvotes, a.publishedAt, now) ||
                b.publishedAt.getTime() - a.publishedAt.getTime(),
        )
        .map((e) => e.id);

describe("showcaseScore", () => {
    it("is (v + 1) / (h + 2)^gravity", () => {
        expect(showcaseScore(0, now, now)).toBeCloseTo(1 / Math.pow(2, SHOWCASE_GRAVITY));
        expect(showcaseScore(9, ago(8), now)).toBeCloseTo(10 / Math.pow(10, SHOWCASE_GRAVITY));
    });

    it("clamps a publication date in the future to age zero", () => {
        expect(showcaseScore(3, new Date(now.getTime() + 5 * HOUR), now)).toBe(showcaseScore(3, now, now));
    });

    it("decays with age at equal votes and grows with votes at equal age", () => {
        expect(showcaseScore(5, ago(1), now)).toBeGreaterThan(showcaseScore(5, ago(10), now));
        expect(showcaseScore(6, ago(10), now)).toBeGreaterThan(showcaseScore(5, ago(10), now));
    });

    it("lets a fresh entry with a few votes pass an old one with many", () => {
        expect(rank([
            { id: "old-popular", upvotes: 40, publishedAt: ago(24 * 7) },
            { id: "fresh", upvotes: 3, publishedAt: ago(3) },
        ])).toEqual(["fresh", "old-popular"]);
    });

    it("keeps a well-voted entry above a brand-new unvoted one on its first day", () => {
        expect(rank([
            { id: "new-unvoted", upvotes: 0, publishedAt: ago(0) },
            { id: "day-old", upvotes: 30, publishedAt: ago(20) },
        ])).toEqual(["day-old", "new-unvoted"]);
    });

    it("breaks ties by the newest publication", () => {
        const at = ago(5);
        expect(rank([
            { id: "a", upvotes: 2, publishedAt: at },
            { id: "b", upvotes: 2, publishedAt: new Date(at.getTime() + 1) },
        ])).toEqual(["b", "a"]);
    });
});

describe("slugs", () => {
    it("folds accents and punctuation into dashes", () => {
        expect(slugify("  L'Été — à Paris!  ")).toBe("l-ete-a-paris");
        expect(slugify("¿?!")).toBe("");
    });

    it("appends the last six id characters", () => {
        expect(showcaseSlug("The Long Night", "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4A5B")).toBe("the-long-night-3f4a5b");
    });

    it("falls back to the suffix alone for a title with no letters", () => {
        expect(showcaseSlug("???", "abcdef123456")).toBe("123456");
    });
});

describe("kinds", () => {
    it("offers the format's full kind or the logline", () => {
        expect(showcaseKindsFor("FEATURE")).toEqual(["FULL_SCRIPT", "LOGLINE"]);
        expect(showcaseKindsFor("PILOT")).toEqual(["PILOT", "LOGLINE"]);
        expect(showcaseKindsFor("OTHER")).toEqual(["FULL_SCRIPT", "LOGLINE"]);
    });
});

describe("parseShowcaseQuery", () => {
    it("defaults to top, every kind, page 1", () => {
        expect(parseShowcaseQuery({})).toEqual({ sort: "top", kind: null, page: 1 });
        expect(parseShowcaseQuery({ sort: "hot", kind: "FULL_SCRIPT", page: "-2" })).toEqual({ sort: "top", kind: null, page: 1 });
    });

    it("reads the URL forms and round-trips through showcaseHref", () => {
        const query = parseShowcaseQuery({ sort: "new", kind: "full-script", page: "3" });
        expect(query).toEqual({ sort: "new", kind: "FULL_SCRIPT", page: 3 });
        expect(showcaseHref(query)).toBe("/community/showcase?sort=new&kind=full-script&page=3");
        expect(showcaseHref({ sort: "top", kind: null, page: 1 })).toBe("/community/showcase");
    });
});

/** Just enough of the transaction client for `applyUpvote`, over two in-memory tables. */
function fakeTx(entries: { submissionId: string; upvoteCount: number; unpublishedAt: Date | null }[]) {
    const votes = new Set<string>();
    const key = (submissionId: string, userId: string) => `${submissionId}:${userId}`;
    const tx = {
        communityShowcaseEntry: {
            findFirst: async ({ where }: { where: { submissionId: string; unpublishedAt: null } }) => {
                const e = entries.find((x) => x.submissionId === where.submissionId && x.unpublishedAt === null);
                return e ? { upvoteCount: e.upvoteCount } : null;
            },
            update: async ({ where, data }: { where: { submissionId: string }; data: { upvoteCount: { increment?: number; decrement?: number } } }) => {
                const e = entries.find((x) => x.submissionId === where.submissionId)!;
                e.upvoteCount += (data.upvoteCount.increment ?? 0) - (data.upvoteCount.decrement ?? 0);
                return { upvoteCount: e.upvoteCount };
            },
        },
        communityUpvote: {
            createMany: async ({ data }: { data: { submissionId: string; userId: string }[] }) => {
                let count = 0;
                for (const d of data) {
                    if (votes.has(key(d.submissionId, d.userId))) continue;
                    votes.add(key(d.submissionId, d.userId));
                    count++;
                }
                return { count };
            },
            deleteMany: async ({ where }: { where: { submissionId: string; userId: string } }) => ({
                count: votes.delete(key(where.submissionId, where.userId)) ? 1 : 0,
            }),
        },
    };
    return { tx: tx as unknown as UpvoteTx, votes, entries };
}

describe("applyUpvote", () => {
    it("counts one upvote per member, however often it is sent", async () => {
        const { tx, votes } = fakeTx([{ submissionId: "s1", upvoteCount: 0, unpublishedAt: null }]);
        expect(await applyUpvote(tx, "s1", "u1", true)).toBe(1);
        expect(await applyUpvote(tx, "s1", "u1", true)).toBe(1);
        expect(await applyUpvote(tx, "s1", "u2", true)).toBe(2);
        expect(votes.size).toBe(2);
    });

    it("takes an upvote back once, and ignores taking back one never given", async () => {
        const { tx } = fakeTx([{ submissionId: "s1", upvoteCount: 0, unpublishedAt: null }]);
        await applyUpvote(tx, "s1", "u1", true);
        expect(await applyUpvote(tx, "s1", "u1", false)).toBe(0);
        expect(await applyUpvote(tx, "s1", "u1", false)).toBe(0);
        expect(await applyUpvote(tx, "s1", "u2", false)).toBe(0);
    });

    it("leaves the cached count alone when nothing changed", async () => {
        // A drifted cache (fixed by the nightly recount) is returned as is, not nudged.
        const { tx, entries } = fakeTx([{ submissionId: "s1", upvoteCount: 7, unpublishedAt: null }]);
        expect(await applyUpvote(tx, "s1", "u1", false)).toBe(7);
        expect(entries[0].upvoteCount).toBe(7);
    });

    it("refuses an unpublished or unknown entry without writing", async () => {
        const { tx, votes } = fakeTx([{ submissionId: "s1", upvoteCount: 0, unpublishedAt: new Date() }]);
        expect(await applyUpvote(tx, "s1", "u1", true)).toBeNull();
        expect(await applyUpvote(tx, "nope", "u1", true)).toBeNull();
        expect(votes.size).toBe(0);
    });
});
