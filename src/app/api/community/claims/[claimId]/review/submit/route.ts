import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessNoContent, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ claimId: z.string() });

/**
 * POST `/community/claims/[claimId]/review/submit`
 *
 * Send the saved draft to the author. 409 `BEFORE_FLOOR` before day 7, 422
 * under the word minimum, 410 once the claim has ended.
 */
async function submitReview(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { claimId } = validate(ParamsSchema, routeParams);
    await ReviewService.submitOwnReview(claimId, user.id);
    return SuccessNoContent();
}

export const POST = apiHandler(submitReview);
