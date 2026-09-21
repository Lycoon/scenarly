import { NextRequest } from "next/server";

import * as SubmissionService from "@src/server/service/community-submission-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ submissionId: z.string() });

/** GET `/community/submissions/[submissionId]/pdf` — short-lived inline URL of the author's own PDF. */
async function getSubmissionPdf(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { submissionId } = validate(ParamsSchema, routeParams);
    return Success(await SubmissionService.getAuthorPdfUrl(submissionId, user.id));
}

export const GET = apiHandler(getSubmissionPdf);
