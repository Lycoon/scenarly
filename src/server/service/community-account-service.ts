/**
 * Community's part of account deletion and of the GDPR export.
 *
 * Deletion: the database cascade from User → CommunityProfile already removes
 * the member's profile, ledger, submissions (with their claims, reviews
 * received and Showcase entry), offer sets, upvotes and reports. Reviews they
 * *sent* stay with the authors who received them, anonymised (the claim's
 * reviewer is SetNull), as Coverage promises authors. What the cascade cannot
 * do is done here first: the R2 objects of their submissions (the tick only
 * reclaims files of rows that still exist), their claim in flight, the drafts
 * they never sent, the cached counts of entries they upvoted, and the cached
 * pages of their Showcase entries.
 */

import * as S3 from "@src/lib/s3";
import * as ReviewService from "@src/server/service/community-review-service";
import prisma from "@src/server/db";
import { submissionObjectPrefix } from "@src/lib/community/constants";
import { logger } from "@src/lib/utils/logger";
import { CommunityReviewStatus } from "@src/generated/client/client";
import { CommunityShowcaseRepository } from "../repository/community-showcase-repository";
import { revalidateShowcase } from "./community-showcase-cache";

const showcase = new CommunityShowcaseRepository();

/** Run before the User row is deleted. Best-effort per step: a failure is logged, never thrown. */
export async function prepareAccountDeletion(userId: string, now = new Date()): Promise<void> {
    const profile = await prisma.communityProfile.findUnique({ where: { userId } });
    if (!profile) return;

    const step = async (name: string, run: () => Promise<unknown>) => {
        try {
            await run();
        } catch (e) {
            logger.error(`[AccountDeletion] Community: ${name} failed`, { userId, error: e });
        }
    };

    // Frees the script for other reviewers now and reclaims the watermarked copy.
    if (profile.activeClaimId) {
        const claimId = profile.activeClaimId;
        await step("release claim", () => ReviewService.endClaim(claimId, "RELEASED", now));
    }
    await step("delete drafts", () =>
        prisma.communityReview.deleteMany({ where: { status: CommunityReviewStatus.DRAFT, claim: { reviewerId: userId } } }),
    );
    await step("withdraw upvotes", () => prisma.$transaction((tx) => showcase.removeAllVotesOf(userId, tx)));

    const owned = await prisma.communitySubmission.findMany({
        where: { authorId: userId },
        select: { id: true, showcase: { select: { slug: true, unpublishedAt: true } } },
    });
    // Off the wall first, so a cached page 404s before its row is gone.
    const published = owned.filter((s) => s.showcase && !s.showcase.unpublishedAt);
    if (published.length > 0) {
        await step("unpublish", () =>
            prisma.communityShowcaseEntry.updateMany({
                where: { submissionId: { in: published.map((s) => s.id) } },
                data: { unpublishedAt: now },
            }),
        );
        for (const s of published) revalidateShowcase(s.showcase!.slug);
    }
    for (const { id } of owned) {
        if (!(await S3.destroyPrefix(submissionObjectPrefix(id)))) {
            logger.error("[AccountDeletion] Community: failed to delete submission files", { userId, submissionId: id });
        }
    }
}

/**
 * Everything Community holds about a member, for `community.json` in the
 * GDPR export, or null if they never joined. The PDFs themselves are not
 * copied into the archive: they are the files the member uploaded, and each is
 * identified by its SHA-256 and still downloadable from the submission page.
 */
export async function exportForUser(userId: string) {
    const profile = await prisma.communityProfile.findUnique({
        where: { userId },
        select: {
            createdAt: true,
            reviewsCompleted: true,
            usefulCount: true,
            notUsefulCount: true,
            lastReshuffleAt: true,
            tickets: { orderBy: { createdAt: "asc" }, select: { delta: true, reason: true, refId: true, createdAt: true } },
            submissions: {
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    createdAt: true,
                    status: true,
                    title: true,
                    logline: true,
                    genres: true,
                    format: true,
                    pageCount: true,
                    sizeBytes: true,
                    sha256: true,
                    poolExitAt: true,
                    retiredAt: true,
                    fileDeletedAt: true,
                    showcase: { select: { kind: true, slug: true, publishedAt: true, unpublishedAt: true, upvoteCount: true } },
                },
            },
            claims: {
                orderBy: { claimedAt: "asc" },
                select: {
                    id: true,
                    status: true,
                    claimedAt: true,
                    endedAt: true,
                    submission: { select: { title: true } },
                    review: {
                        select: {
                            status: true,
                            worksWell: true,
                            doesNotWork: true,
                            remarks: true,
                            wordCount: true,
                            signed: true,
                            autoSubmitted: true,
                            submittedAt: true,
                            rating: true,
                        },
                    },
                },
            },
            upvotes: { orderBy: { createdAt: "asc" }, select: { createdAt: true, entry: { select: { slug: true } } } },
            reports: { orderBy: { createdAt: "asc" }, select: { reason: true, details: true, createdAt: true, reviewClaimId: true } },
        },
    });
    if (!profile) return null;

    const { tickets, submissions, claims, upvotes, reports, ...rest } = profile;
    return {
        profile: rest,
        tickets,
        submissions,
        reviewsWritten: claims,
        upvotes: upvotes.map((u) => ({ entry: u.entry.slug, createdAt: u.createdAt })),
        reportsFiled: reports,
    };
}
