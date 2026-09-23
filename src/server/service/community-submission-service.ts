/**
 * Coverage submissions: a frozen PDF on R2 plus its metadata.
 *
 * Two paths feed `createSubmission` — a Scenarly project exported in the
 * browser, or a PDF the user uploaded — and both arrive as bytes: the server
 * never renders a screenplay. The upload is validated (size, parseable PDF,
 * page bounds, Coverage being feature screenplays only, duplicate hash), then the charge and the row are
 * written in one transaction with the object already in R2, so a failed
 * commit leaves nothing charged and only an orphan object to delete.
 *
 * Author-facing reads never select a reviewer's id; the review label is the
 * reviewer's position or, when they signed, their username.
 */

import * as S3 from "@src/lib/s3";
import * as ProjectService from "@src/server/service/project-service";
import * as TicketService from "@src/server/service/community-ticket-service";
import prisma from "@src/server/db";
import { sha256Hex } from "@src/lib/assets/asset-hash";
import { inspectPdf } from "@src/lib/community/pdf";
import {
    COVERAGE_FORMAT,
    COVERAGE_PAGE_BOUNDS,
    MAX_PDF_BYTES,
    MIN_COMPLETED_REVIEWS,
    PAGE_BOUNDS,
    POOL_TTL_MS,
    PRESIGN_TTL_S,
    SUBMISSION_COST,
    submissionObjectKey,
} from "@src/lib/community/constants";
import { AppError, BodyFieldError, ConflictError, ForbiddenError, NotFoundError } from "@src/lib/utils/api-utils";
import { logger } from "@src/lib/utils/logger";
import {
    CommunityClaimStatus,
    CommunityFormat,
    CommunityGenre,
    CommunityReviewStatus,
    CommunityShowcaseKind,
    CommunitySubmissionStatus,
} from "@src/generated/client/client";
import { showcaseSlug } from "@src/lib/community/showcase";
import { revalidateShowcase } from "@src/server/service/community-showcase-cache";
import { CommunityShowcaseRepository } from "../repository/community-showcase-repository";
import { CommunitySubmissionRepository } from "../repository/community-submission-repository";

const submissions = new CommunitySubmissionRepository();
const showcase = new CommunityShowcaseRepository();

export type SubmissionDestination = "COVERAGE" | "SHOWCASE_ONLY";

export interface SubmissionInput {
    title: string;
    logline: string;
    genres: CommunityGenre[];
    format: CommunityFormat;
    sourceProjectId?: string | null;
    destination: SubmissionDestination;
    /** Showcase-only uploads published in the same transaction (see `ShowcaseService.publishUpload`). */
    showcaseKind?: CommunityShowcaseKind;
}

export class DuplicatePdfError extends AppError {
    constructor(public registeredAt: Date) {
        super(409, "This PDF was already submitted", "DUPLICATE_PDF");
    }
}

export class AccountTooRecentError extends AppError {
    constructor() {
        super(403, "The account is too recent to submit to Coverage", "ACCOUNT_TOO_RECENT");
    }
}

/** Filename a PDF is served under, safe for a Content-Disposition header. */
export const downloadName = (title: string) => `${title.replace(/[^\w\- ]+/g, "").trim() || "screenplay"}.pdf`;

export async function createSubmission(authorId: string, bytes: Uint8Array, input: SubmissionInput, now = new Date()) {
    // Coverage is the one thing a new account waits for: starter tickets are
    // spent here, so fresh throwaway accounts can't flood the pool.
    const pooled = input.destination === "COVERAGE";
    if (pooled && !(await TicketService.getUserEligibility(authorId, now)).ok) throw new AccountTooRecentError();

    if (bytes.byteLength === 0) throw new BodyFieldError("Empty file");
    if (bytes.byteLength > MAX_PDF_BYTES) throw new BodyFieldError("PDF exceeds the maximum size");

    let pageCount: number;
    try {
        ({ pageCount } = await inspectPdf(bytes));
    } catch {
        throw new BodyFieldError("The file is not a readable, unencrypted PDF");
    }
    // Coverage is feature screenplays only; the format field is ignored for it.
    const format = pooled ? COVERAGE_FORMAT : input.format;
    const bounds = pooled ? COVERAGE_PAGE_BOUNDS : PAGE_BOUNDS[format];
    if (pageCount < bounds.min || pageCount > bounds.max) {
        throw new BodyFieldError(
            pooled
                ? `Coverage takes feature screenplays of ${bounds.min} to ${bounds.max} pages`
                : `A ${format.toLowerCase()} must have ${bounds.min} to ${bounds.max} pages`,
        );
    }

    // The source project says the PDF came from the editor (Showcase's "Written
    // with Scenarly") and keeps its members from reviewing it: only a member
    // may name it.
    if (input.sourceProjectId && !(await ProjectService.getMembership(input.sourceProjectId, authorId))) {
        throw new BodyFieldError("Unknown source project");
    }

    const sha256 = await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    const sameHash = await submissions.findBySha256(sha256);
    const blocking = sameHash.find(
        (row) => row.authorId !== authorId || row.status === CommunitySubmissionStatus.POOLED,
    );
    if (blocking) throw new DuplicatePdfError(sameHash[0].createdAt);

    const submission = await prisma.$transaction(async (tx) => {
        const created = await submissions.create(
            {
                authorId,
                status: pooled ? CommunitySubmissionStatus.POOLED : CommunitySubmissionStatus.SHOWCASE_ONLY,
                title: input.title,
                logline: input.logline,
                genres: input.genres,
                format,
                pageCount,
                sizeBytes: bytes.byteLength,
                sha256,
                sourceProjectId: input.sourceProjectId ?? null,
                poolExitAt: pooled ? new Date(now.getTime() + POOL_TTL_MS) : null,
            },
            tx,
        );
        if (pooled) await TicketService.chargeSubmission(authorId, created.id, tx);
        if (!pooled && input.showcaseKind) {
            await showcase.create(
                { submissionId: created.id, kind: input.showcaseKind, slug: showcaseSlug(created.title, created.id), publishedAt: now },
                tx,
            );
        }

        // Upload inside the transaction: a failed put rolls the charge back.
        const ok = await S3.putObject(submissionObjectKey(created.id), bytes, "application/pdf");
        if (!ok) throw new AppError(500, "Failed to store the PDF");
        return created;
    });

    logger.info("[Community] Submission created", { submissionId: submission.id, authorId, pooled });
    return submission;
}

export const listMine = (authorId: string) => submissions.listByAuthor(authorId);

/** Author view: the submission and its submitted reviews, reviewer identities withheld. */
export async function getForAuthor(submissionId: string, authorId: string) {
    const submission = await submissions.findById(submissionId);
    if (!submission || submission.authorId !== authorId || submission.status === CommunitySubmissionStatus.REMOVED) {
        throw new NotFoundError("Submission not found");
    }

    const claims = await prisma.communityClaim.findMany({
        where: { submissionId, status: CommunityClaimStatus.SUBMITTED, review: { status: CommunityReviewStatus.SUBMITTED } },
        orderBy: { endedAt: "asc" },
        select: {
            id: true,
            review: {
                select: {
                    worksWell: true,
                    doesNotWork: true,
                    remarks: true,
                    wordCount: true,
                    signed: true,
                    autoSubmitted: true,
                    submittedAt: true,
                    rating: true,
                    ratedAt: true,
                    reports: { where: { reporterId: authorId }, select: { id: true } },
                },
            },
            reviewer: { select: { user: { select: { username: true } } } },
        },
    });

    const [activeClaims, entry] = await Promise.all([
        prisma.communityClaim.count({ where: { submissionId, status: CommunityClaimStatus.ACTIVE } }),
        showcase.findBySubmissionId(submissionId),
    ]);

    const reviews = claims.map((c, i) => ({
        claimId: c.id,
        // "Reviewer n" keeps blind reviews distinguishable across visits; a
        // signed review shows the username (null if unset or the account is gone).
        reviewer: c.review!.signed ? c.reviewer?.user.username ?? null : null,
        position: i + 1,
        worksWell: c.review!.worksWell,
        doesNotWork: c.review!.doesNotWork,
        remarks: c.review!.remarks,
        wordCount: c.review!.wordCount,
        autoSubmitted: c.review!.autoSubmitted,
        submittedAt: c.review!.submittedAt,
        rating: c.review!.rating,
        ratedAt: c.review!.ratedAt,
        reported: c.review!.reports.length > 0,
    }));

    const { sha256, sizeBytes, ...rest } = submission;
    const published = entry && !entry.unpublishedAt ? { kind: entry.kind, slug: entry.slug, upvoteCount: entry.upvoteCount } : null;
    return { ...rest, sha256, sizeBytes, activeClaims, reviews, showcase: published };
}

/**
 * Withdraw. Never claimed: REMOVED and refunded in full. Claimed at least
 * once: RETIRED, no refund; claims in flight finish and still pay. Either way
 * the Showcase entry, if any, goes offline.
 */
export async function withdraw(submissionId: string, authorId: string, now = new Date()) {
    const submission = await submissions.findById(submissionId);
    if (!submission || submission.authorId !== authorId) throw new NotFoundError("Submission not found");
    if (submission.status === CommunitySubmissionStatus.REMOVED) throw new ConflictError("Already withdrawn");

    await prisma.$transaction(async (tx) => {
        const neverClaimed = submission.claimCount === 0;
        const pooled = submission.status === CommunitySubmissionStatus.POOLED;

        if (neverClaimed || !pooled) {
            await submissions.updateStatus(submissionId, CommunitySubmissionStatus.REMOVED, {}, tx);
            if (pooled) await TicketService.refundSubmission(authorId, submissionId, SUBMISSION_COST, tx);
        } else {
            await submissions.updateStatus(submissionId, CommunitySubmissionStatus.RETIRED, { retiredAt: now }, tx);
        }

        await showcase.unpublish(submissionId, now, tx);
    });

    // The entry's page is cached for minutes; drop it now so its slug 404s.
    const entry = await showcase.findBySubmissionId(submissionId);
    if (entry) revalidateShowcase(entry.slug);
}

/** Presigned inline URL of the author's own frozen PDF. */
export async function getAuthorPdfUrl(submissionId: string, authorId: string) {
    const submission = await submissions.findById(submissionId);
    if (!submission || submission.authorId !== authorId) throw new NotFoundError("Submission not found");
    if (submission.fileDeletedAt) throw new NotFoundError("This PDF is no longer stored");
    if (submission.status === CommunitySubmissionStatus.REMOVED) throw new ForbiddenError("Submission withdrawn");

    const url = await S3.getSignedDownloadUrl(submissionObjectKey(submissionId), PRESIGN_TTL_S, {
        contentType: "application/pdf",
        contentDisposition: `inline; filename="${downloadName(submission.title)}"`,
    });
    if (!url) throw new AppError(500, "Failed to sign the PDF URL");
    return { url, expiresAt: new Date(Date.now() + PRESIGN_TTL_S * 1000) };
}

/** Public proof of prior existence: when a hash was first registered. */
export const getProof = (sha256: string) => submissions.firstRegisteredAt(sha256);

/** Retire pooled submissions whose month is up and whose reviews are in. Returns how many. */
export async function retireDue(now: Date, take = 200): Promise<number> {
    const due = await submissions.listRetirable(now, MIN_COMPLETED_REVIEWS, take);
    for (const { id } of due) {
        await submissions.updateStatus(id, CommunitySubmissionStatus.RETIRED, { retiredAt: now });
    }
    return due.length;
}
