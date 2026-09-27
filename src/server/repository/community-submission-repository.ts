import {
    CommunityFormat,
    CommunityGenre,
    CommunitySubmissionStatus,
    Prisma,
} from "../../generated/client/client";
import prisma from "../db";
import type { Db } from "./community-profile-repository";

export interface SubmissionCreation {
    authorId: string;
    status: CommunitySubmissionStatus;
    title: string;
    logline: string;
    genres: CommunityGenre[];
    format: CommunityFormat;
    pageCount: number;
    sizeBytes: number;
    sha256: string;
    sourceProjectId?: string | null;
    poolExitAt?: Date | null;
}

/** What a reviewer may see of a submission: never the author. */
export const SUBMISSION_BLIND_SELECT = {
    id: true,
    title: true,
    logline: true,
    genres: true,
    format: true,
    pageCount: true,
    status: true,
    completedReviewCount: true,
} satisfies Prisma.CommunitySubmissionSelect;

export class CommunitySubmissionRepository {
    create(data: SubmissionCreation, db: Db = prisma) {
        return db.communitySubmission.create({ data });
    }

    findById(id: string, db: Db = prisma) {
        return db.communitySubmission.findUnique({ where: { id } });
    }

    listByAuthor(authorId: string) {
        return prisma.communitySubmission.findMany({
            where: { authorId, status: { not: CommunitySubmissionStatus.REMOVED } },
            orderBy: { createdAt: "desc" },
            include: {
                showcase: { select: { kind: true, slug: true, unpublishedAt: true, upvoteCount: true } },
                _count: { select: { claims: { where: { status: "ACTIVE" } } } },
            },
        });
    }

    /** Rows sharing a hash: the dedup check looks at their status and owner. */
    findBySha256(sha256: string, db: Db = prisma) {
        return db.communitySubmission.findMany({
            where: { sha256 },
            select: { id: true, authorId: true, status: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });
    }

    /** First registration date of a hash, for the public proof endpoint. */
    async firstRegisteredAt(sha256: string): Promise<Date | null> {
        const row = await prisma.communitySubmission.findFirst({
            where: { sha256 },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        });
        return row?.createdAt ?? null;
    }

    updateStatus(
        id: string,
        status: CommunitySubmissionStatus,
        extra: Partial<Pick<Prisma.CommunitySubmissionUncheckedUpdateInput, "retiredAt" | "fileDeletedAt">> = {},
        db: Db = prisma,
    ) {
        return db.communitySubmission.update({ where: { id }, data: { status, ...extra } });
    }

    incrementCounters(
        id: string,
        counters: { offerCount?: number; claimCount?: number; completedReviewCount?: number },
        db: Db = prisma,
    ) {
        return db.communitySubmission.update({
            where: { id },
            data: {
                ...(counters.offerCount && { offerCount: { increment: counters.offerCount } }),
                ...(counters.claimCount && { claimCount: { increment: counters.claimCount } }),
                ...(counters.completedReviewCount && {
                    completedReviewCount: { increment: counters.completedReviewCount },
                }),
            },
        });
    }

    /**
     * Pooled submissions a reviewer may be offered: not their own, not from a
     * project they belong to, never claimed by them before. Returns the counters
     * the draw weighs on.
     */
    listCandidatesFor(reviewerId: string, now: Date) {
        return prisma.communitySubmission.findMany({
            where: {
                status: CommunitySubmissionStatus.POOLED,
                authorId: { not: reviewerId },
                claims: { none: { reviewerId } },
                OR: [{ sourceProjectId: null }, { sourceProject: { members: { none: { userId: reviewerId } } } }],
                // Retirement is the tick's job, but never offer what is past due.
                poolExitAt: { gt: now },
            },
            select: {
                id: true,
                completedReviewCount: true,
                offerCount: true,
                _count: { select: { claims: { where: { status: "ACTIVE" } } } },
            },
        });
    }

    /** Pooled rows whose month is up and whose three reviews are in. */
    listRetirable(now: Date, minReviews: number, take: number) {
        return prisma.communitySubmission.findMany({
            where: {
                status: CommunitySubmissionStatus.POOLED,
                poolExitAt: { lte: now },
                completedReviewCount: { gte: minReviews },
            },
            select: { id: true },
            take,
        });
    }

    /** REMOVED rows whose R2 objects are still there. */
    listReclaimable(take: number) {
        return prisma.communitySubmission.findMany({
            where: { status: CommunitySubmissionStatus.REMOVED, fileDeletedAt: null },
            select: { id: true },
            take,
        });
    }

    /** Recount `completedReviewCount` from SUBMITTED claims, for the nightly recount. */
    async recountCompletedReviews(): Promise<void> {
        await prisma.$executeRaw`
            UPDATE "CommunitySubmission" s
            SET "completedReviewCount" = (
                SELECT COUNT(*) FROM "CommunityClaim" c
                WHERE c."submissionId" = s.id AND c.status = 'SUBMITTED'
            )
            WHERE s.status IN ('POOLED', 'RETIRED')`;
    }
}
