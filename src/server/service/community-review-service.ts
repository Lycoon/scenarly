/**
 * Coverage reviewing: offer sets, claims, drafts, submission, rating, reports.
 *
 * A claim never takes a submission out of the pool — claims are concurrent and
 * an active one only nudges the script's draw weight down so offers spread.
 * What is exclusive is the reviewer's side: one ACTIVE claim per reviewer,
 * guarded by `CommunityProfile.activeClaimId`, and never the same script twice
 * (`CommunityClaim @@unique([submissionId, reviewerId])`).
 *
 * `submitReview` is the single path a claim takes to SUBMITTED, whether the
 * reviewer clicks Submit or the tick auto-sends a draft at the 7-day floor:
 * one transaction moves the review, the claim, the reviewer's active slot,
 * the ledger (+1) and the counters together.
 */

import { after } from "next/server";

import * as S3 from "@src/lib/s3";
import * as TicketService from "@src/server/service/community-ticket-service";
import prisma from "@src/server/db";
import { watermarkPdf } from "@src/lib/community/pdf";
import { reputation, selectOffers } from "@src/lib/community/selection";
import { claimClock, isReviewLongEnough, reviewWordCount } from "@src/lib/community/rules";
import {
    MIN_REVIEW_WORDS,
    OFFER_SIZE,
    PRESIGN_TTL_S,
    RESHUFFLE_COOLDOWN_MS,
    claimObjectKey,
    submissionObjectKey,
} from "@src/lib/community/constants";
import { sendDraftAutoSubmittedEmail, sendReviewReceivedEmail } from "@src/lib/mail/mail";
import {
    AppError,
    BodyFieldError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    TooManyRequestsError,
} from "@src/lib/utils/api-utils";
import { logger } from "@src/lib/utils/logger";
import {
    CommunityClaimStatus,
    CommunityRating,
    CommunityReportReason,
    CommunityReviewStatus,
    CommunitySubmissionStatus,
} from "@src/generated/client/client";
import { CommunityProfileRepository } from "../repository/community-profile-repository";
import { CommunityReviewRepository } from "../repository/community-review-repository";
import { CommunitySubmissionRepository } from "../repository/community-submission-repository";

const profiles = new CommunityProfileRepository();
const submissions = new CommunitySubmissionRepository();
const reviews = new CommunityReviewRepository();

class ClaimStateError extends AppError {
    constructor(message: string, code: string, status = 409) {
        super(status, message, code);
    }
}

// ── Offer sets ────────────────────────────────────────────────────────────────

async function makeOfferSet(reviewerId: string, now: Date) {
    const [profile, candidates] = await Promise.all([
        TicketService.requireProfile(reviewerId),
        submissions.listCandidatesFor(reviewerId, now),
    ]);
    const rho = reputation(profile.usefulCount, profile.notUsefulCount);
    const picked = selectOffers(
        candidates.map((c) => ({
            id: c.id,
            completedReviewCount: c.completedReviewCount,
            activeClaimCount: c._count.claims,
            offerCount: c.offerCount,
        })),
        rho,
        OFFER_SIZE,
    );

    return prisma.$transaction(async (tx) => {
        for (const c of picked) await submissions.incrementCounters(c.id, { offerCount: 1 }, tx);
        return reviews.createOfferSet(reviewerId, picked.map((c) => c.id), tx);
    });
}

/** The reviewer's current set, made on demand. 409 while a claim is active. */
export async function getOffers(reviewerId: string, now = new Date()) {
    const profile = await TicketService.requireProfile(reviewerId);
    if (profile.activeClaimId) throw new ClaimStateError("Finish your current review first", "HAS_ACTIVE_CLAIM");

    const latest = await reviews.findLatestOfferSet(reviewerId);
    const set = latest && !latest.consumedAt ? latest : await makeOfferSet(reviewerId, now);
    return toOfferView(set, profile.lastReshuffleAt, now);
}

/** A fresh set, once per 24 h. */
export async function reshuffle(reviewerId: string, now = new Date()) {
    const profile = await TicketService.requireProfile(reviewerId);
    if (profile.activeClaimId) throw new ClaimStateError("Finish your current review first", "HAS_ACTIVE_CLAIM");

    const retryAt = profile.lastReshuffleAt
        ? new Date(profile.lastReshuffleAt.getTime() + RESHUFFLE_COOLDOWN_MS)
        : null;
    if (retryAt && retryAt.getTime() > now.getTime()) {
        const err = new TooManyRequestsError("One reshuffle per day");
        err.code = "RESHUFFLE_COOLDOWN";
        throw err;
    }

    await profiles.setLastReshuffle(reviewerId, now);
    const set = await makeOfferSet(reviewerId, now);
    return toOfferView(set, now, now);
}

type OfferSet = NonNullable<Awaited<ReturnType<CommunityReviewRepository["findLatestOfferSet"]>>>;

const toOfferView = (set: OfferSet, lastReshuffleAt: Date | null, now: Date) => ({
    id: set.id,
    createdAt: set.createdAt,
    canReshuffleAt: lastReshuffleAt ? new Date(lastReshuffleAt.getTime() + RESHUFFLE_COOLDOWN_MS) : now,
    items: set.items.map((item) => ({
        ...item.submission,
        available: item.submission.status === CommunitySubmissionStatus.POOLED,
    })),
});

// ── Claims ────────────────────────────────────────────────────────────────────

export async function claim(reviewerId: string, submissionId: string, now = new Date()) {
    await TicketService.requireProfile(reviewerId);
    const set = await reviews.findLatestOfferSet(reviewerId);
    const offered = set && !set.consumedAt && set.items.some((i) => i.submissionId === submissionId);
    if (!offered) throw new ClaimStateError("This script is not in your current offers", "NOT_OFFERED");

    const submission = await submissions.findById(submissionId);
    if (!submission || submission.status !== CommunitySubmissionStatus.POOLED) {
        throw new ClaimStateError("This script has left the pool", "NOT_OFFERED");
    }

    const { floorAt, deadlineAt } = claimClock(now);
    const created = await prisma.$transaction(async (tx) => {
        const row = await reviews.createClaim(reviewerId, submissionId, floorAt, deadlineAt, tx);
        const taken = await profiles.setActiveClaim(reviewerId, row.id, tx);
        if (taken === 0) throw new ClaimStateError("Finish your current review first", "HAS_ACTIVE_CLAIM");
        await submissions.incrementCounters(submissionId, { claimCount: 1 }, tx);
        await reviews.consumeOfferSet(set.id, now, tx);
        return row;
    });

    logger.info("[Community] Claim created", { claimId: created.id, reviewerId, submissionId });
    return { id: created.id, floorAt, deadlineAt };
}

type ClaimRow = NonNullable<Awaited<ReturnType<CommunityReviewRepository["findClaim"]>>>;

/** Own, ACTIVE claim or the matching error. */
async function requireActiveClaim(claimId: string, reviewerId: string): Promise<ClaimRow> {
    const row = await reviews.findClaim(claimId);
    if (!row || row.reviewerId !== reviewerId) throw new NotFoundError("Claim not found");
    if (row.status !== CommunityClaimStatus.ACTIVE) throw new ClaimStateError("This claim has ended", "CLAIM_ENDED", 410);
    return row;
}

const toClaimView = (row: ClaimRow, now: Date) => ({
    id: row.id,
    status: row.status,
    claimedAt: row.claimedAt,
    floorAt: row.floorAt,
    deadlineAt: row.deadlineAt,
    endedAt: row.endedAt,
    canSubmit: row.status === CommunityClaimStatus.ACTIVE && now.getTime() >= row.floorAt.getTime(),
    minWords: MIN_REVIEW_WORDS,
    submission: row.submission,
    review: row.review && {
        status: row.review.status,
        worksWell: row.review.worksWell,
        doesNotWork: row.review.doesNotWork,
        remarks: row.review.remarks,
        signed: row.review.signed,
        wordCount: row.review.wordCount,
        autoSubmitted: row.review.autoSubmitted,
        submittedAt: row.review.submittedAt,
        rating: row.review.rating,
        updatedAt: row.review.updatedAt,
    },
});

export async function getActiveClaim(reviewerId: string, now = new Date()) {
    const row = await reviews.findActiveClaim(reviewerId);
    // Past the deadline the tick will expire it; never show it as workable.
    if (!row || row.deadlineAt.getTime() <= now.getTime()) return null;
    return toClaimView(row, now);
}

export async function listEndedClaims(reviewerId: string, take = 20, cursor?: string) {
    const rows = await reviews.listEndedClaims(reviewerId, take, cursor);
    const now = new Date();
    return rows.map((r) => toClaimView(r, now));
}

/** Presigned URL of the reviewer's watermarked copy, stamped on first call. */
export async function getClaimPdfUrl(claimId: string, reviewerId: string) {
    const row = await requireActiveClaim(claimId, reviewerId);

    let key = row.watermarkKey;
    if (!key) {
        const original = await S3.getObjectBytes(submissionObjectKey(row.submissionId));
        if (!original) throw new NotFoundError("The script is no longer stored");
        const stamp = `Scenarly Coverage · claim ${claimId.slice(-8)} · ${row.claimedAt.toISOString().slice(0, 10)}`;
        const stamped = await watermarkPdf(original, stamp);
        key = claimObjectKey(row.submissionId, claimId);
        const ok = await S3.putObject(key, stamped, "application/pdf");
        if (!ok) throw new AppError(500, "Failed to store the reviewer copy");
        await reviews.setWatermarkKey(claimId, key);
    }

    const url = await S3.getSignedDownloadUrl(key, PRESIGN_TTL_S, {
        contentType: "application/pdf",
        contentDisposition: `inline; filename="coverage-${claimId.slice(-8)}.pdf"`,
    });
    if (!url) throw new AppError(500, "Failed to sign the PDF URL");
    return { url, expiresAt: new Date(Date.now() + PRESIGN_TTL_S * 1000) };
}

// ── Drafts and submission ─────────────────────────────────────────────────────

export interface DraftInput {
    worksWell: string;
    doesNotWork: string;
    remarks: string;
    signed: boolean;
}

export async function saveDraft(claimId: string, reviewerId: string, input: DraftInput) {
    const row = await requireActiveClaim(claimId, reviewerId);
    if (row.review?.status === CommunityReviewStatus.SUBMITTED) {
        throw new ClaimStateError("This review was already sent", "ALREADY_SUBMITTED");
    }
    const wordCount = reviewWordCount(input);
    const saved = await reviews.upsertDraft(claimId, { ...input, wordCount });
    return { wordCount: saved.wordCount, minWords: MIN_REVIEW_WORDS, updatedAt: saved.updatedAt };
}

/** Reclaim the watermarked copy once a claim has ended. Best effort. */
async function reclaimWatermark(claimId: string, key: string | null) {
    if (!key) return;
    await S3.destroyMany([key]);
    await reviews.setWatermarkKey(claimId, null).catch(() => {});
}

/**
 * Move an ACTIVE claim to SUBMITTED. Shared by the reviewer's Submit and the
 * tick's auto-send. Returns false when the claim was no longer ACTIVE (a
 * concurrent submit or expiry won), true when this call did the work.
 */
export async function submitReview(claimId: string, now: Date, autoSubmitted: boolean): Promise<boolean> {
    const result = await prisma.$transaction(async (tx) => {
        await reviews.lockClaim(claimId, tx);
        const row = await reviews.findClaim(claimId, tx);
        if (!row || row.status !== CommunityClaimStatus.ACTIVE || !row.reviewerId) return null;
        if (now.getTime() < row.floorAt.getTime()) {
            throw new ClaimStateError("The 7-day waiting period is not over", "BEFORE_FLOOR");
        }
        if (!row.review || !isReviewLongEnough(row.review.wordCount)) {
            throw new BodyFieldError(`A review needs at least ${MIN_REVIEW_WORDS} words in total`);
        }

        await reviews.submitReview(claimId, now, autoSubmitted, tx);
        await reviews.endClaim(claimId, CommunityClaimStatus.SUBMITTED, now, tx);
        await profiles.clearActiveClaim(row.reviewerId, claimId, tx);
        await TicketService.payReview(row.reviewerId, claimId, tx);
        await submissions.incrementCounters(row.submissionId, { completedReviewCount: 1 }, tx);
        await profiles.incrementReviewsCompleted(row.reviewerId, tx);

        const submission = await tx.communitySubmission.findUnique({
            where: { id: row.submissionId },
            select: { id: true, title: true, author: { select: { user: { select: { email: true } } } } },
        });
        const reviewer = autoSubmitted
            ? await tx.communityProfile.findUnique({
                  where: { userId: row.reviewerId },
                  select: { user: { select: { email: true } } },
              })
            : null;
        return { watermarkKey: row.watermarkKey, submission, reviewerEmail: reviewer?.user.email ?? null };
    });
    if (!result) return false;

    const { watermarkKey, submission, reviewerEmail } = result;
    after(async () => {
        await reclaimWatermark(claimId, watermarkKey);
        if (submission) {
            await sendReviewReceivedEmail(submission.author.user.email, submission.title, submission.id).catch(() => {});
            if (reviewerEmail) await sendDraftAutoSubmittedEmail(reviewerEmail, submission.title).catch(() => {});
        }
    });
    logger.info("[Community] Review submitted", { claimId, autoSubmitted });
    return true;
}

/** Reviewer's Submit: own ACTIVE claim, then the shared path. */
export async function submitOwnReview(claimId: string, reviewerId: string, now = new Date()) {
    await requireActiveClaim(claimId, reviewerId);
    const done = await submitReview(claimId, now, false);
    if (!done) throw new ClaimStateError("This claim has ended", "CLAIM_ENDED", 410);
}

/** End an ACTIVE claim without a review: by the reviewer (RELEASED) or the tick (EXPIRED). */
export async function endClaim(claimId: string, status: "RELEASED" | "EXPIRED", now: Date): Promise<boolean> {
    const ended = await prisma.$transaction(async (tx) => {
        await reviews.lockClaim(claimId, tx);
        const row = await reviews.findClaim(claimId, tx);
        if (!row || row.status !== CommunityClaimStatus.ACTIVE) return null;
        await reviews.endClaim(claimId, CommunityClaimStatus[status], now, tx);
        if (row.reviewerId) await profiles.clearActiveClaim(row.reviewerId, claimId, tx);
        return row.watermarkKey;
    });
    if (ended === null) return false;
    await reclaimWatermark(claimId, ended);
    return true;
}

export async function releaseOwnClaim(claimId: string, reviewerId: string, now = new Date()) {
    const row = await requireActiveClaim(claimId, reviewerId);
    if (row.review?.status === CommunityReviewStatus.SUBMITTED) {
        throw new ClaimStateError("This review was already sent", "ALREADY_SUBMITTED");
    }
    await endClaim(claimId, "RELEASED", now);
}

// ── Author side ───────────────────────────────────────────────────────────────

async function requireAuthoredReview(claimId: string, authorId: string) {
    const review = await reviews.findReviewWithClaim(claimId);
    if (!review || review.claim.submission.authorId !== authorId || review.status !== CommunityReviewStatus.SUBMITTED) {
        throw new NotFoundError("Review not found");
    }
    return review;
}

export async function rateReview(claimId: string, authorId: string, rating: CommunityRating, now = new Date()) {
    const review = await requireAuthoredReview(claimId, authorId);
    await prisma.$transaction(async (tx) => {
        const set = await reviews.rate(claimId, rating, now, tx);
        if (set === 0) throw new ConflictError("Already rated");
        if (review.claim.reviewerId) {
            await profiles.incrementRating(review.claim.reviewerId, rating === CommunityRating.USEFUL, tx);
        }
    });
}

export async function reportReview(claimId: string, authorId: string, reason: CommunityReportReason, details?: string) {
    await requireAuthoredReview(claimId, authorId);
    try {
        return await reviews.createReport(claimId, authorId, reason, details);
    } catch {
        throw new ConflictError("Already reported");
    }
}

/** Guard used by routes that act on a claim the caller must own. */
export async function assertClaimOwner(claimId: string, reviewerId: string) {
    const row = await reviews.findClaim(claimId);
    if (!row || row.reviewerId !== reviewerId) throw new ForbiddenError();
    return row;
}
