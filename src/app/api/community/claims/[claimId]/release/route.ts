import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessNoContent, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ claimId: z.string() });

/** POST `/community/claims/[claimId]/release` — give the script up without a review; no credit, no penalty. */
async function releaseClaim(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { claimId } = validate(ParamsSchema, routeParams);
    await ReviewService.releaseOwnClaim(claimId, user.id);
    return SuccessNoContent();
}

export const POST = apiHandler(releaseClaim);
