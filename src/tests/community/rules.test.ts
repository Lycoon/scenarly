import { describe, it, expect } from "vitest";

import { claimClock, countWords, getEligibility, isReviewLongEnough, reviewWordCount } from "@src/lib/community/rules";
import {
    CLAIM_DEADLINE_MS,
    CLAIM_FLOOR_MS,
    ENTRY_MIN_ACCOUNT_AGE_MS,
    MIN_REVIEW_WORDS,
} from "@src/lib/community/constants";

describe("getEligibility", () => {
    const now = new Date("2026-09-21T12:00:00Z");

    it("rejects an unverified email", () => {
        expect(getEligibility(null, now)).toEqual({ ok: false, reason: "UNVERIFIED" });
    });

    it("rejects a verification younger than the minimum age and says when it passes", () => {
        const verified = new Date(now.getTime() - ENTRY_MIN_ACCOUNT_AGE_MS + 60_000);
        const result = getEligibility(verified, now);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("TOO_RECENT");
        expect(result.eligibleAt?.getTime()).toBe(verified.getTime() + ENTRY_MIN_ACCOUNT_AGE_MS);
    });

    it("accepts a verification exactly at the minimum age", () => {
        const verified = new Date(now.getTime() - ENTRY_MIN_ACCOUNT_AGE_MS);
        expect(getEligibility(verified, now)).toEqual({ ok: true });
    });
});

describe("word counting", () => {
    it("counts whitespace-separated words and ignores padding", () => {
        expect(countWords("")).toBe(0);
        expect(countWords("   ")).toBe(0);
        expect(countWords("one")).toBe(1);
        expect(countWords("  one two\n\nthree\tfour ")).toBe(4);
    });

    it("sums the three sections", () => {
        expect(reviewWordCount({ worksWell: "a b", doesNotWork: "c", remarks: "" })).toBe(3);
    });

    it("applies the minimum inclusively", () => {
        expect(isReviewLongEnough(MIN_REVIEW_WORDS - 1)).toBe(false);
        expect(isReviewLongEnough(MIN_REVIEW_WORDS)).toBe(true);
    });
});

describe("claimClock", () => {
    it("fixes the floor and the deadline from the claim time", () => {
        const claimedAt = new Date("2026-09-01T00:00:00Z");
        const { floorAt, deadlineAt } = claimClock(claimedAt);
        expect(floorAt.getTime() - claimedAt.getTime()).toBe(CLAIM_FLOOR_MS);
        expect(deadlineAt.getTime() - claimedAt.getTime()).toBe(CLAIM_DEADLINE_MS);
    });
});
