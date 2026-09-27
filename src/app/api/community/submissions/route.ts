import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import * as SubmissionService from "@src/server/service/community-submission-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, SuccessCreated } from "@src/lib/utils/api-utils";
import { readSubmissionForm } from "@src/lib/community/submission-form";

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
 * `DUPLICATE_PDF` / `INSUFFICIENT_TICKETS`. A Showcase-only upload meant to
 * be published goes to `/community/showcase/upload` instead.
 */
async function createSubmission(req: NextRequest, { user }: AuthApiContext) {
    await TicketService.requireProfile(user.id);
    const { bytes, fields } = await readSubmissionForm(req);
    // `kind` is the Showcase upload's field; this route never publishes.
    const submission = await SubmissionService.createSubmission(user.id, bytes, { ...fields, showcaseKind: undefined });
    return SuccessCreated({ id: submission.id, status: submission.status, poolExitAt: submission.poolExitAt });
}

export const GET = apiHandler(listSubmissions);
export const POST = apiHandler(createSubmission);
