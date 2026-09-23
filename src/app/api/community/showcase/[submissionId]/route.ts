import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessNoContent, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ submissionId: z.string() });

/**
 * DELETE `/community/showcase/[submissionId]`
 *
 * Take the caller's entry off Showcase. The slug 404s from then on; the
 * submission, its reviews and its upvotes are untouched.
 */
async function unpublish(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { submissionId } = validate(ParamsSchema, routeParams);
    await ShowcaseService.unpublish(submissionId, user.id);
    return SuccessNoContent();
}

export const DELETE = apiHandler(unpublish);
