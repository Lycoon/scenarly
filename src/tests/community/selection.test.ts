import { describe, it, expect } from "vitest";

import { candidateWeight, reputation, selectOffers, type SelectionCandidate } from "@src/lib/community/selection";

const candidate = (id: string, over: Partial<SelectionCandidate> = {}): SelectionCandidate => ({
    id,
    completedReviewCount: 0,
    activeClaimCount: 0,
    offerCount: 0,
    ...over,
});

/** Deterministic uniform source cycling through fixed values. */
const seeded = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
};

describe("reputation", () => {
    it("starts a new reviewer at 0.5", () => {
        expect(reputation(0, 0)).toBe(0.5);
    });

    it("rises with Useful and falls with Not useful, smoothed", () => {
        expect(reputation(10, 0)).toBeCloseTo(12 / 14);
        expect(reputation(0, 10)).toBeCloseTo(2 / 14);
        // One vote barely moves it.
        expect(reputation(0, 1)).toBeCloseTo(0.4);
    });
});

describe("candidateWeight", () => {
    it("favours scripts with fewer completed reviews, claims and offers", () => {
        const fresh = candidateWeight(candidate("a"), 0.5);
        const reviewed = candidateWeight(candidate("b", { completedReviewCount: 3 }), 0.5);
        const claimed = candidateWeight(candidate("c", { activeClaimCount: 2 }), 0.5);
        const offered = candidateWeight(candidate("d", { offerCount: 10 }), 0.5);
        expect(fresh).toBeGreaterThan(claimed);
        expect(claimed).toBeGreaterThan(reviewed);
        expect(fresh).toBeGreaterThan(offered);
        expect(offered).toBeGreaterThan(reviewed);
    });

    it("steers a well-rated reviewer harder toward untouched scripts", () => {
        const reviewed = candidate("b", { completedReviewCount: 3 });
        const ratioGood = candidateWeight(candidate("a"), 0.9) / candidateWeight(reviewed, 0.9);
        const ratioPoor = candidateWeight(candidate("a"), 0.1) / candidateWeight(reviewed, 0.1);
        expect(ratioGood).toBeGreaterThan(ratioPoor);
    });

    it("keeps a script with 3 reviews eligible", () => {
        expect(candidateWeight(candidate("b", { completedReviewCount: 3 }), 1)).toBeGreaterThan(0);
    });
});

describe("selectOffers", () => {
    it("returns at most the requested size and never duplicates", () => {
        const pool = Array.from({ length: 12 }, (_, i) => candidate(`s${i}`));
        const picked = selectOffers(pool, 0.5, 5, seeded([0.3, 0.7, 0.1, 0.9, 0.5]));
        expect(picked).toHaveLength(5);
        expect(new Set(picked.map((p) => p.id)).size).toBe(5);
    });

    it("returns the whole pool when it is smaller than the set", () => {
        const pool = [candidate("a"), candidate("b")];
        expect(selectOffers(pool, 0.5, 5, seeded([0.2]))).toHaveLength(2);
    });

    it("returns nothing from an empty pool", () => {
        expect(selectOffers([], 0.5)).toEqual([]);
    });

    it("prefers the lighter-reviewed script under equal luck", () => {
        // Same uniform draw for both: the higher weight wins the key.
        const pool = [candidate("reviewed", { completedReviewCount: 5 }), candidate("fresh")];
        const picked = selectOffers(pool, 0.5, 1, seeded([0.5]));
        expect(picked[0].id).toBe("fresh");
    });

    it("is not deterministic across different draws", () => {
        const pool = Array.from({ length: 30 }, (_, i) => candidate(`s${i}`));
        const a = selectOffers(pool, 0.5, 5, seeded([0.11, 0.23, 0.37, 0.41, 0.59, 0.67, 0.73]))
            .map((c) => c.id)
            .join(",");
        const b = selectOffers(pool, 0.5, 5, seeded([0.97, 0.83, 0.71, 0.61, 0.53, 0.43, 0.31]))
            .map((c) => c.id)
            .join(",");
        expect(a).not.toBe(b);
    });
});
