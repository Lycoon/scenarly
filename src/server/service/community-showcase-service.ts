/**
 * Showcase: the public wall of scripts their authors chose to share.
 *
 * An entry hangs off a submission — one that went through Coverage and was
 * opted in, or a Showcase-only upload published in the same transaction as
 * its row. Unpublishing only stamps `unpublishedAt`: the submission, its
 * reviews and its upvotes stay, and publishing again gives a fresh
 * `publishedAt` under the same slug.
 *
 * Everything public goes through `SHOWCASE_PUBLIC_SELECT`, which never
 * reaches the author: Coverage is double-blind and a pooled script can be on
 * the wall at the same time.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";

import * as S3 from "@src/lib/s3";
import * as SubmissionService from "@src/server/service/community-submission-service";
import * as TicketService from "@src/server/service/community-ticket-service";
import prisma from "@src/server/db";
import { PRESIGN_TTL_S, SHOWCASE_PAGE_SIZE, submissionObjectKey } from "@src/lib/community/constants";
import { showcaseKindsFor, showcaseSlug, showsPdf, type ShowcaseQuery } from "@src/lib/community/showcase";
import type { ShowcaseEntryView, ShowcasePageView } from "@src/lib/community/types";
import { AppError, BodyFieldError, NotFoundError } from "@src/lib/utils/api-utils";
import { logger } from "@src/lib/utils/logger";
import { CommunityFormat, CommunityShowcaseKind, CommunitySubmissionStatus, Prisma } from "@src/generated/client/client";
import { CommunityShowcaseRepository, type ShowcasePublicRow } from "../repository/community-showcase-repository";
import { CommunitySubmissionRepository } from "../repository/community-submission-repository";
import { applyUpvote } from "./community-upvote";
import { revalidateShowcase, SHOWCASE_TAG, WALL_TTL_S } from "./community-showcase-cache";

const showcase = new CommunityShowcaseRepository();
const submissions = new CommunitySubmissionRepository();

export class AlreadyPublishedError extends AppError {
    constructor() {
        super(409, "This script is already on Showcase", "ALREADY_PUBLISHED");
    }
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

function assertKindFits(kind: CommunityShowcaseKind, format: CommunityFormat) {
    if (!showcaseKindsFor(format).includes(kind)) {
        throw new BodyFieldError(`A ${format.toLowerCase()} can be shown as ${showcaseKindsFor(format).join(" or ")}`);
    }
}

export const toView = (row: ShowcasePublicRow): ShowcaseEntryView => ({
    submissionId: row.submissionId,
    slug: row.slug,
    kind: row.kind,
    title: row.submission.title,
    logline: row.submission.logline,
    genres: row.submission.genres,
    format: row.submission.format,
    pageCount: row.submission.pageCount,
    publishedAt: row.publishedAt.toISOString(),
    upvoteCount: row.upvoteCount,
    fromScenarly: row.submission.sourceProjectId !== null,
});

// ── Author side ─────────────────────────────────────────────────────────────

/** Opt an existing submission in. 409 if it is already on the wall. */
export async function publish(submissionId: string, authorId: string, kind: CommunityShowcaseKind, now = new Date()) {
    const submission = await submissions.findById(submissionId);
    if (!submission || submission.authorId !== authorId || submission.status === CommunitySubmissionStatus.REMOVED) {
        throw new NotFoundError("Submission not found");
    }
    assertKindFits(kind, submission.format);

    const existing = await showcase.findBySubmissionId(submissionId);
    if (existing && !existing.unpublishedAt) throw new AlreadyPublishedError();

    let slug: string;
    try {
        slug = existing
            ? (await showcase.republish(submissionId, kind, now)).slug
            : (await showcase.create({ submissionId, kind, slug: showcaseSlug(submission.title, submissionId), publishedAt: now })).slug;
    } catch (e) {
        // Two first publishes racing on the primary key.
        if (isUniqueViolation(e)) throw new AlreadyPublishedError();
        throw e;
    }

    revalidateShowcase(slug);
    logger.info("[Community] Showcase entry published", { submissionId, kind });
    return { slug };
}

/** Upload straight to Showcase: a SHOWCASE_ONLY submission and its entry, no tickets. */
export async function publishUpload(
    authorId: string,
    bytes: Uint8Array,
    input: Omit<SubmissionService.SubmissionInput, "destination" | "showcaseKind">,
    kind: CommunityShowcaseKind,
) {
    assertKindFits(kind, input.format);
    const submission = await SubmissionService.createSubmission(authorId, bytes, {
        ...input,
        destination: "SHOWCASE_ONLY",
        showcaseKind: kind,
    });
    const slug = showcaseSlug(submission.title, submission.id);
    revalidateShowcase(slug);
    return { id: submission.id, slug };
}

/** Take an entry off the wall; the slug 404s from now on. */
export async function unpublish(submissionId: string, authorId: string, now = new Date()) {
    const submission = await submissions.findById(submissionId);
    if (!submission || submission.authorId !== authorId) throw new NotFoundError("Submission not found");

    const entry = await showcase.findBySubmissionId(submissionId);
    if (!entry || (await showcase.unpublish(submissionId, now)) === 0) throw new NotFoundError("Not on Showcase");
    revalidateShowcase(entry.slug);
}

// ── Upvotes ─────────────────────────────────────────────────────────────────

/** Set or clear the caller's upvote. Members only; idempotent. Returns the new count. */
export async function setUpvote(submissionId: string, userId: string, on: boolean) {
    await TicketService.requireProfile(userId);
    const upvoteCount = await prisma.$transaction((tx) => applyUpvote(tx, submissionId, userId, on));
    if (upvoteCount === null) throw new NotFoundError("Not on Showcase");
    return { upvoteCount };
}

/** Fresh counts and the caller's own votes for entries rendered from a cached page. */
export async function getVotes(userId: string, submissionIds: string[]) {
    const rows = await showcase.votesFor(userId, submissionIds);
    return {
        votes: Object.fromEntries(rows.map((r) => [r.submissionId, { upvoted: r.upvoted, upvoteCount: r.upvoteCount }])),
    };
}

// ── Public reads ────────────────────────────────────────────────────────────

async function readWall({ sort, kind, page }: ShowcaseQuery, now = new Date()): Promise<ShowcasePageView> {
    const total = await showcase.countPublished(kind);
    const pageCount = Math.max(1, Math.ceil(total / SHOWCASE_PAGE_SIZE));
    const rows =
        page > pageCount
            ? []
            : await showcase.listPublished({ sort, kind, skip: (page - 1) * SHOWCASE_PAGE_SIZE, take: SHOWCASE_PAGE_SIZE, now });
    return { entries: rows.map(toView), page, pageCount, total };
}

/** One page of the wall, cached per query for `WALL_TTL_S` (dropped on publish/unpublish). */
export const listWall = unstable_cache((query: ShowcaseQuery) => readWall(query), ["community-showcase-wall"], {
    revalidate: WALL_TTL_S,
    tags: [SHOWCASE_TAG],
});

/** A published entry. Deduplicated per request: the page and its metadata both ask. */
export const getBySlug = cache(async (slug: string): Promise<ShowcaseEntryView | null> => {
    const row = await showcase.findPublishedBySlug(slug);
    return row ? toView(row) : null;
});

export async function getBySlugForViewer(slug: string, viewerId: string | null) {
    const entry = await getBySlug(slug);
    if (!entry) throw new NotFoundError("Not on Showcase");
    const viewerHasUpvoted = viewerId ? await showcase.hasUpvoted(entry.submissionId, viewerId) : false;
    return { ...entry, viewerHasUpvoted };
}

/** Presigned inline URL of a published entry's PDF. No watermark: the author made it public. */
export async function getPublicPdfUrl(slug: string) {
    const row = await showcase.findPublishedBySlug(slug);
    if (!row || !showsPdf(row.kind) || row.submission.fileDeletedAt) throw new NotFoundError("Not on Showcase");

    const url = await S3.getSignedDownloadUrl(submissionObjectKey(row.submissionId), PRESIGN_TTL_S, {
        contentType: "application/pdf",
        contentDisposition: `inline; filename="${SubmissionService.downloadName(row.submission.title)}"`,
    });
    if (!url) throw new AppError(500, "Failed to sign the PDF URL");
    return { url, expiresAt: new Date(Date.now() + PRESIGN_TTL_S * 1000) };
}

export const listForSitemap = unstable_cache(
    async () => (await showcase.listAllPublished()).map((e) => ({ slug: e.slug, publishedAt: e.publishedAt.toISOString() })),
    ["community-showcase-sitemap"],
    { revalidate: 3600, tags: [SHOWCASE_TAG] },
);
