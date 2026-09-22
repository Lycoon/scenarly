import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import * as SubmissionService from "@src/server/service/community-submission-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { BodyFieldError, Success, SuccessCreated, validate } from "@src/lib/utils/api-utils";
import {
    GENRES_MAX,
    GENRES_MIN,
    LOGLINE_MAX_LENGTH,
    LOGLINE_MIN_LENGTH,
    MAX_PDF_BYTES,
    TITLE_MAX_LENGTH,
} from "@src/lib/community/constants";
import { CommunityFormat, CommunityGenre } from "@src/generated/client/client";

import z from "zod";

const FieldsSchema = z.object({
    title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
    logline: z.string().trim().min(LOGLINE_MIN_LENGTH).max(LOGLINE_MAX_LENGTH),
    genres: z.array(z.nativeEnum(CommunityGenre)).min(GENRES_MIN).max(GENRES_MAX),
    // Ignored for COVERAGE (always FEATURE); picks the page bounds for Showcase-only uploads.
    format: z.nativeEnum(CommunityFormat).default(CommunityFormat.FEATURE),
    sourceProjectId: z.string().optional(),
    destination: z.enum(["COVERAGE", "SHOWCASE_ONLY"]).default("COVERAGE"),
});

/** GET `/community/submissions` — the caller's submissions, newest first. */
async function listSubmissions(req: NextRequest, { user }: AuthApiContext) {
    await TicketService.requireProfile(user.id);
    const submissions = await SubmissionService.listMine(user.id);
    return Success({
        submissions: submissions.map((s) => ({
            id: s.id,
            createdAt: s.createdAt,
            status: s.status,
            title: s.title,
            logline: s.logline,
            genres: s.genres,
            format: s.format,
            pageCount: s.pageCount,
            poolExitAt: s.poolExitAt,
            completedReviewCount: s.completedReviewCount,
            activeClaims: s._count.claims,
            showcase: s.showcase && !s.showcase.unpublishedAt ? s.showcase : null,
        })),
    });
}

/**
 * POST `/community/submissions` (multipart/form-data)
 *
 * Fields: `file` (the PDF), `title`, `logline`, `genres` (repeated),
 * `format?`, `sourceProjectId?`, `destination?` (COVERAGE | SHOWCASE_ONLY).
 * Uses 3 tickets for COVERAGE, which takes feature screenplays only. 422 on size/pages/fields, 409
 * `DUPLICATE_PDF` / `INSUFFICIENT_TICKETS`.
 */
async function createSubmission(req: NextRequest, { user }: AuthApiContext) {
    await TicketService.requireProfile(user.id);

    // Reject oversized bodies before reading them into memory.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_PDF_BYTES + 64 * 1024) throw new BodyFieldError("PDF exceeds the maximum size");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new BodyFieldError("Missing PDF file");

    const fields = validate(FieldsSchema, {
        title: form.get("title"),
        logline: form.get("logline"),
        genres: form.getAll("genres"),
        format: form.get("format") ?? undefined,
        sourceProjectId: form.get("sourceProjectId") ?? undefined,
        destination: form.get("destination") ?? undefined,
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const submission = await SubmissionService.createSubmission(user.id, bytes, fields);
    return SuccessCreated({ id: submission.id, status: submission.status, poolExitAt: submission.poolExitAt });
}

export const GET = apiHandler(listSubmissions);
export const POST = apiHandler(createSubmission);
