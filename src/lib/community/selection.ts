/**
 * Offer-set selection for Coverage.
 *
 * Pure: takes the pooled candidates a reviewer may see (already filtered for
 * ownership and prior claims by the caller) and draws `OFFER_SIZE` of them,
 * weighted toward scripts with fewer completed reviews, fewer claims in flight
 * and fewer offers so far. The reviewer's reputation shapes how strongly the
 * draw favours untouched scripts: a well-rated reviewer is steered hard toward
 * them, a poorly rated one gets a flatter draw, so a first review is more
 * likely to come from someone whose notes authors found useful.
 */

import { OFFER_SIZE } from "./constants";

export interface SelectionCandidate {
    id: string;
    completedReviewCount: number;
    activeClaimCount: number;
    offerCount: number;
}

/**
 * Smoothed share of Useful verdicts in [0, 1]. Two virtual Useful and two
 * virtual Not useful votes mean a new reviewer sits at 0.5 and the first few
 * ratings cannot sink anyone.
 */
export const reputation = (usefulCount: number, notUsefulCount: number): number =>
    (usefulCount + 2) / (usefulCount + notUsefulCount + 4);

/** Draw weight of one candidate for a reviewer of reputation `rho`. */
export const candidateWeight = (c: SelectionCandidate, rho: number): number => {
    const scarcity = 1 / (1 + c.completedReviewCount + 0.5 * c.activeClaimCount + 0.1 * c.offerCount);
    return Math.pow(scarcity, 0.5 + rho);
};

/**
 * Weighted sample without replacement (Efraimidis–Spirakis): each candidate
 * gets key u^(1/w) for a uniform u, and the top `size` keys win. `random` is
 * injectable so tests can pin the draw.
 */
export const selectOffers = (
    candidates: SelectionCandidate[],
    rho: number,
    size = OFFER_SIZE,
    random: () => number = Math.random,
): SelectionCandidate[] => {
    const keyed = candidates.map((c) => {
        const w = candidateWeight(c, rho);
        // u in (0, 1]: a 0 would give every candidate the same key of 0.
        const u = 1 - random();
        return { c, key: Math.pow(u, 1 / w) };
    });
    keyed.sort((a, b) => b.key - a.key);
    return keyed.slice(0, size).map((k) => k.c);
};
