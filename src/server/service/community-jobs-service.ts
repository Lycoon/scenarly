/**
 * The Community tick: everything that has to happen when nobody is looking.
 *
 * Called every 15 minutes by the Worker cron through
 * `/api/internal/community-tick`. Each task is idempotent (conditional
 * updates, the ledger unique, a column that records the send) and bounded
 * (`BATCH` rows per tick), so a backlog after downtime drains over a few
 * ticks instead of one long request. `tick(now)` takes the clock as an
 * argument so it can be driven from a test with fixed dates.
 *
 * Read paths never depend on the tick for correctness — `getActiveClaim`
 * already hides a claim past its deadline, `submitReview` re-checks the floor
 * — the tick only makes state move.
 */

import * as S3 from "@src/lib/s3";
import * as ReviewService from "@src/server/service/community-review-service";
import * as SubmissionService from "@src/server/service/community-submission-service";
import prisma from "@src/server/db";
import { CLAIM_REMINDER_LEAD_MS, MIN_REVIEW_WORDS, submissionObjectPrefix } from "@src/lib/community/constants";
import { sendClaimExpiringEmail } from "@src/lib/mail/mail";
import { logger } from "@src/lib/utils/logger";
import { CommunityReviewRepository } from "../repository/community-review-repository";
import { CommunitySubmissionRepository } from "../repository/community-submission-repository";

const reviews = new CommunityReviewRepository();
const submissions = new CommunitySubmissionRepository();

const BATCH = 200;
/** Hour (UTC) whose first tick also runs the counter recount. */
const RECOUNT_HOUR_UTC = 3;

export interface TickReport {
    skipped: boolean;
    expired: number;
    autoSubmitted: number;
    retired: number;
    reminded: number;
    reclaimed: number;
    recounted: boolean;
}

const LOCK_KEY = "community-tick";

async function withAdvisoryLock<T>(run: () => Promise<T>): Promise<T | null> {
    const [{ locked }] = await prisma.$queryRaw<[{ locked: boolean }]>`
        SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY})) AS locked`;
    if (!locked) return null;
    try {
        return await run();
    } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
    }
}

async function expireClaims(now: Date): Promise<number> {
    const due = await reviews.listExpired(now, BATCH);
    let count = 0;
    for (const { id } of due) if (await ReviewService.endClaim(id, "EXPIRED", now)) count++;
    return count;
}

async function autoSubmitDrafts(now: Date): Promise<number> {
    const due = await reviews.listAutoSubmittable(now, MIN_REVIEW_WORDS, BATCH);
    let count = 0;
    for (const { id } of due) {
        try {
            if (await ReviewService.submitReview(id, now, true)) count++;
        } catch (e) {
            logger.error("[Community] Auto-submit failed", { claimId: id, error: e });
        }
    }
    return count;
}

async function remindDeadlines(now: Date): Promise<number> {
    const due = await reviews.listDueForReminder(new Date(now.getTime() + CLAIM_REMINDER_LEAD_MS), BATCH);
    let count = 0;
    for (const claim of due) {
        const email = claim.reviewer?.user.email;
        // Mark first: a send that throws must not be retried every 15 minutes.
        await reviews.setReminderSent(claim.id, now);
        if (!email) continue;
        const title = await prisma.communityClaim
            .findUnique({ where: { id: claim.id }, select: { submission: { select: { title: true } } } })
            .then((c) => c?.submission.title ?? "a script");
        await sendClaimExpiringEmail(email, title, claim.deadlineAt).catch((e) =>
            logger.error("[Community] Reminder email failed", { claimId: claim.id, error: e }),
        );
        count++;
    }
    return count;
}

async function reclaimFiles(now: Date): Promise<number> {
    let count = 0;

    const removed = await submissions.listReclaimable(BATCH);
    for (const { id } of removed) {
        if (await S3.destroyPrefix(submissionObjectPrefix(id))) {
            await prisma.communitySubmission.update({ where: { id }, data: { fileDeletedAt: now } });
            count++;
        }
    }

    const stray = await reviews.listStrayWatermarks(BATCH);
    if (stray.length > 0) {
        await S3.destroyMany(stray.map((s) => s.watermarkKey!));
        await prisma.communityClaim.updateMany({
            where: { id: { in: stray.map((s) => s.id) } },
            data: { watermarkKey: null },
        });
        count += stray.length;
    }
    return count;
}

async function recount(): Promise<void> {
    await submissions.recountCompletedReviews();
    await reviews.recountReputation();
    await prisma.$executeRaw`
        UPDATE "CommunityShowcaseEntry" e
        SET "upvoteCount" = (SELECT COUNT(*) FROM "CommunityUpvote" u WHERE u."submissionId" = e."submissionId")`;
}

export async function tick(now = new Date()): Promise<TickReport> {
    const report = await withAdvisoryLock(async () => {
        const expired = await expireClaims(now);
        const autoSubmitted = await autoSubmitDrafts(now);
        const retired = await SubmissionService.retireDue(now, BATCH);
        const reminded = await remindDeadlines(now);
        const reclaimed = await reclaimFiles(now);

        const recounted = now.getUTCHours() === RECOUNT_HOUR_UTC && now.getUTCMinutes() < 15;
        if (recounted) await recount();

        return { skipped: false, expired, autoSubmitted, retired, reminded, reclaimed, recounted };
    });

    if (!report) {
        return { skipped: true, expired: 0, autoSubmitted: 0, retired: 0, reminded: 0, reclaimed: 0, recounted: false };
    }
    logger.info("[Community] Tick", report);
    return report;
}
