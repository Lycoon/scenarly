/**
 * Shapes the Community API hands to the browser. Dates arrive as ISO strings
 * (JSON), so every date field here is a string.
 */

import type {
    CommunityClaimStatus,
    CommunityFormat,
    CommunityGenre,
    CommunityRating,
    CommunityReviewStatus,
    CommunityShowcaseKind,
    CommunitySubmissionStatus,
} from "@src/generated/client/browser";
import type { EligibilityReason } from "./rules";

export interface CommunityEligibility {
    ok: boolean;
    reason?: EligibilityReason;
    eligibleAt?: string;
}

export interface CommunityProfileView {
    penName: string;
    createdAt: string;
    reviewsCompleted: number;
    usefulCount: number;
    notUsefulCount: number;
}

/** What a reviewer sees of a script: never its author. */
export interface BlindSubmission {
    id: string;
    title: string;
    logline: string;
    genres: CommunityGenre[];
    format: CommunityFormat;
    pageCount: number;
    status: CommunitySubmissionStatus;
    completedReviewCount: number;
}

export interface ReviewView {
    status: CommunityReviewStatus;
    worksWell: string;
    doesNotWork: string;
    remarks: string;
    signed: boolean;
    wordCount: number;
    autoSubmitted: boolean;
    submittedAt: string | null;
    rating: CommunityRating | null;
    updatedAt: string;
}

export interface ClaimView {
    id: string;
    status: CommunityClaimStatus;
    claimedAt: string;
    floorAt: string;
    deadlineAt: string;
    endedAt: string | null;
    canSubmit: boolean;
    minWords: number;
    submission: BlindSubmission;
    review: ReviewView | null;
}

export interface CommunityMe {
    profile: CommunityProfileView | null;
    eligibility: CommunityEligibility;
    balance: number;
    activeClaim: ClaimView | null;
}

export interface OfferItem extends BlindSubmission {
    available: boolean;
}

export interface OfferSetView {
    id: string;
    createdAt: string;
    canReshuffleAt: string;
    items: OfferItem[];
}

export interface MySubmission {
    id: string;
    createdAt: string;
    status: CommunitySubmissionStatus;
    title: string;
    logline: string;
    genres: CommunityGenre[];
    format: CommunityFormat;
    pageCount: number;
    poolExitAt: string | null;
    completedReviewCount: number;
    activeClaims: number;
    showcase: { kind: CommunityShowcaseKind; slug: string; upvoteCount: number } | null;
}

export interface ReceivedReview {
    claimId: string;
    /** Pen name when the reviewer signed, else null (shown as "Reviewer n"). */
    reviewer: string | null;
    position: number;
    worksWell: string;
    doesNotWork: string;
    remarks: string;
    wordCount: number;
    autoSubmitted: boolean;
    submittedAt: string | null;
    rating: CommunityRating | null;
    ratedAt: string | null;
    reported: boolean;
}

export interface SubmissionDetail extends Omit<MySubmission, "activeClaims" | "showcase"> {
    sha256: string;
    sizeBytes: number;
    retiredAt: string | null;
    activeClaims: number;
    reviews: ReceivedReview[];
}

export interface CreditEntry {
    id: string;
    delta: number;
    reason: string;
    refId: string;
    createdAt: string;
}

export interface PresignedPdf {
    url: string;
    expiresAt: string;
}
