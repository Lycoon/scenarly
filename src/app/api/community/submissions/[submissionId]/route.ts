import { NextRequest } from "next/server";

import * as SubmissionService from "@src/server/service/community-submission-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, SuccessNoContent, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ submissionId: z.string() });

/** GET `/community/submissions/[submissionId]` — author view with the reviews received. */
async function getSubmission(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { submissionId } = validate(ParamsSchema, routeParams);
    return Success(await SubmissionService.getForAuthor(submissionId, user.id));
}

/**
 * DELETE `/community/submissions/[submissionId]`
 *
 * Withdraw. Refunded in full when never claimed; otherwise retired with the
 * claims in flight allowed to finish.
 */
async function withdrawSubmission(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { submissionId } = validate(ParamsSchema, routeParams);
    await SubmissionService.withdraw(submissionId, user.id);
    return SuccessNoContent();
}

export const GET = apiHandler(getSubmission);
export const DELETE = apiHandler(withdrawSubmission);
