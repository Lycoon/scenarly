/**
 * Coverage rules that both the client and the server evaluate: the entry gate,
 * the review length, and the claim clock. Pure functions of their inputs so the
 * form can show the same verdict the API will give.
 */

import {
    CLAIM_DEADLINE_MS,
    CLAIM_FLOOR_MS,
    ENTRY_MIN_ACCOUNT_AGE_MS,
    MIN_REVIEW_WORDS,
} from "./constants";

export type EligibilityReason = "UNVERIFIED" | "TOO_RECENT";

export interface Eligibility {
    ok: boolean;
    reason?: EligibilityReason;
    /** When the account becomes old enough (TOO_RECENT only). */
    eligibleAt?: Date;
}

/**
 * A verified email, at least `minAgeMs` (default a week) old. The email alone
 * opens Community; the age only gates submitting to Coverage.
 */
export const getEligibility = (
    emailVerified: Date | null | undefined,
    now: Date,
    minAgeMs = ENTRY_MIN_ACCOUNT_AGE_MS,
): Eligibility => {
    if (!emailVerified) return { ok: false, reason: "UNVERIFIED" };
    const eligibleAt = new Date(emailVerified.getTime() + minAgeMs);
    if (eligibleAt.getTime() > now.getTime()) return { ok: false, reason: "TOO_RECENT", eligibleAt };
    return { ok: true };
};

/** Words in a review section: whitespace-separated runs of non-space characters. */
export const countWords = (text: string): number => {
    const trimmed = text.trim();
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
};

/** Total words across the three review sections. */
export const reviewWordCount = (parts: { worksWell: string; doesNotWork: string; remarks: string }): number =>
    countWords(parts.worksWell) + countWords(parts.doesNotWork) + countWords(parts.remarks);

export const isReviewLongEnough = (wordCount: number): boolean => wordCount >= MIN_REVIEW_WORDS;

/** The two fixed dates of a claim, derived once from the claim time. */
export const claimClock = (claimedAt: Date) => ({
    floorAt: new Date(claimedAt.getTime() + CLAIM_FLOOR_MS),
    deadlineAt: new Date(claimedAt.getTime() + CLAIM_DEADLINE_MS),
});
