import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ submissionId: z.string() });

/** PUT `/community/showcase/[submissionId]/upvote` — upvote; idempotent. `{ upvoteCount }`. */
async function upvote(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { submissionId } = validate(ParamsSchema, routeParams);
    return Success(await ShowcaseService.setUpvote(submissionId, user.id, true));
}

/** DELETE `/community/showcase/[submissionId]/upvote` — take the upvote back; idempotent. `{ upvoteCount }`. */
async function removeUpvote(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { submissionId } = validate(ParamsSchema, routeParams);
    return Success(await ShowcaseService.setUpvote(submissionId, user.id, false));
}

export const PUT = apiHandler(upvote);
export const DELETE = apiHandler(removeUpvote);
