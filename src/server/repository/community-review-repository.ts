import {
    CommunityClaimStatus,
    CommunityRating,
    CommunityReportReason,
    CommunityReviewStatus,
} from "../../generated/client/client";
import prisma from "../db";
import type { Db } from "./community-profile-repository";
import { SUBMISSION_BLIND_SELECT } from "./community-submission-repository";

export interface ReviewDraft {
    worksWell: string;
    doesNotWork: string;
    remarks: string;
    signed: boolean;
    wordCount: number;
}

export class CommunityReviewRepository {
    // ── Offer sets ──────────────────────────────────────────────────────────

    /** The reviewer's newest set, with its items in order (blind selects only). */
    findLatestOfferSet(reviewerId: string, db: Db = prisma) {
        return db.communityOfferSet.findFirst({
            where: { reviewerId },
            orderBy: { createdAt: "desc" },
            include: {
                items: {
                    orderBy: { position: "asc" },
                    include: { submission: { select: SUBMISSION_BLIND_SELECT } },
                },
            },
        });
    }

    createOfferSet(reviewerId: string, submissionIds: string[], db: Db = prisma) {
        return db.communityOfferSet.create({
            data: {
                reviewerId,
                items: { create: submissionIds.map((submissionId, position) => ({ submissionId, position })) },
            },
            include: {
                items: {
                    orderBy: { position: "asc" },
                    include: { submission: { select: SUBMISSION_BLIND_SELECT } },
                },
            },
        });
    }

    consumeOfferSet(id: string, at: Date, db: Db = prisma) {
        return db.communityOfferSet.update({ where: { id }, data: { consumedAt: at } });
    }

    // ── Claims ──────────────────────────────────────────────────────────────

    createClaim(reviewerId: string, submissionId: string, floorAt: Date, deadlineAt: Date, db: Db = prisma) {
        return db.communityClaim.create({ data: { reviewerId, submissionId, floorAt, deadlineAt } });
    }

    findClaim(id: string, db: Db = prisma) {
        return db.communityClaim.findUnique({
            where: { id },
            include: { submission: { select: SUBMISSION_BLIND_SELECT }, review: true },
        });
    }

    /** Lock a claim row for the rest of the transaction. */
    async lockClaim(id: string, db: Db): Promise<void> {
        await db.$queryRaw`SELECT id FROM "CommunityClaim" WHERE id = ${id} FOR UPDATE`;
    }

    findActiveClaim(reviewerId: string) {
        return prisma.communityClaim.findFirst({
            where: { reviewerId, status: CommunityClaimStatus.ACTIVE },
            include: { submission: { select: SUBMISSION_BLIND_SELECT }, review: true },
        });
    }

    listEndedClaims(reviewerId: string, take: number, cursor?: string) {
        return prisma.communityClaim.findMany({
            where: { reviewerId, status: { not: CommunityClaimStatus.ACTIVE } },
            orderBy: [{ endedAt: "desc" }, { id: "desc" }],
            take,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            include: { submission: { select: SUBMISSION_BLIND_SELECT }, review: true },
        });
    }

    /** Move a claim out of ACTIVE. Returns 1 if it was still ACTIVE, else 0. */
    async endClaim(id: string, status: CommunityClaimStatus, endedAt: Date, db: Db = prisma): Promise<number> {
        const res = await db.communityClaim.updateMany({
            where: { id, status: CommunityClaimStatus.ACTIVE },
            data: { status, endedAt },
        });
        return res.count;
    }

    setWatermarkKey(id: string, key: string | null, db: Db = prisma) {
        return db.communityClaim.update({ where: { id }, data: { watermarkKey: key } });
    }

    setReminderSent(id: string, at: Date) {
        return prisma.communityClaim.update({ where: { id }, data: { reminderSentAt: at } });
    }

    /** ACTIVE claims past their deadline. */
    listExpired(now: Date, take: number) {
        return prisma.communityClaim.findMany({
            where: { status: CommunityClaimStatus.ACTIVE, deadlineAt: { lte: now } },
            select: { id: true, reviewerId: true, watermarkKey: true, submissionId: true },
            take,
        });
    }

    /** ACTIVE claims past the floor whose draft is long enough to send. */
    listAutoSubmittable(now: Date, minWords: number, take: number) {
        return prisma.communityClaim.findMany({
            where: {
                status: CommunityClaimStatus.ACTIVE,
                floorAt: { lte: now },
                review: { status: CommunityReviewStatus.DRAFT, wordCount: { gte: minWords } },
            },
            select: { id: true },
            take,
        });
    }

    /** ACTIVE claims close to their deadline that were not reminded yet. */
    listDueForReminder(before: Date, take: number) {
        return prisma.communityClaim.findMany({
            where: { status: CommunityClaimStatus.ACTIVE, deadlineAt: { lte: before }, reminderSentAt: null },
            select: { id: true, deadlineAt: true, reviewer: { select: { user: { select: { email: true } } } } },
            take,
        });
    }

    /** Ended claims still holding a watermarked copy. */
    listStrayWatermarks(take: number) {
        return prisma.communityClaim.findMany({
            where: { status: { not: CommunityClaimStatus.ACTIVE }, watermarkKey: { not: null } },
            select: { id: true, watermarkKey: true },
            take,
        });
    }

    // ── Reviews ─────────────────────────────────────────────────────────────

    upsertDraft(claimId: string, draft: ReviewDraft, db: Db = prisma) {
        return db.communityReview.upsert({
            where: { claimId },
            create: { claimId, ...draft },
            update: draft,
        });
    }

    submitReview(claimId: string, at: Date, autoSubmitted: boolean, db: Db = prisma) {
        return db.communityReview.update({
            where: { claimId },
            data: { status: CommunityReviewStatus.SUBMITTED, submittedAt: at, autoSubmitted },
        });
    }

    findReviewWithClaim(claimId: string, db: Db = prisma) {
        return db.communityReview.findUnique({
            where: { claimId },
            include: { claim: { select: { reviewerId: true, status: true, submission: { select: { authorId: true } } } } },
        });
    }

    /** Rate once: returns 1 if this call set the rating, 0 if it was already set. */
    async rate(claimId: string, rating: CommunityRating, at: Date, db: Db = prisma): Promise<number> {
        const res = await db.communityReview.updateMany({
            where: { claimId, status: CommunityReviewStatus.SUBMITTED, rating: null },
            data: { rating, ratedAt: at },
        });
        return res.count;
    }

    createReport(claimId: string, reporterId: string, reason: CommunityReportReason, details?: string) {
        return prisma.communityReviewReport.create({
            data: { reviewClaimId: claimId, reporterId, reason, details: details ?? null },
        });
    }

    /** Recount the reputation caches from the ratings, for the nightly recount. */
    async recountReputation(): Promise<void> {
        await prisma.$executeRaw`
            UPDATE "CommunityProfile" p
            SET "usefulCount" = (
                    SELECT COUNT(*) FROM "CommunityClaim" c JOIN "CommunityReview" r ON r."claimId" = c.id
                    WHERE c."reviewerId" = p."userId" AND r.rating = 'USEFUL'),
                "notUsefulCount" = (
                    SELECT COUNT(*) FROM "CommunityClaim" c JOIN "CommunityReview" r ON r."claimId" = c.id
                    WHERE c."reviewerId" = p."userId" AND r.rating = 'NOT_USEFUL'),
                "reviewsCompleted" = (
                    SELECT COUNT(*) FROM "CommunityClaim" c
                    WHERE c."reviewerId" = p."userId" AND c.status = 'SUBMITTED')`;
    }
}
