import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessNoContent, validate } from "@src/lib/utils/api-utils";
import { CommunityRating } from "@src/generated/client/client";

import z from "zod";

const ParamsSchema = z.object({ claimId: z.string() });
const BodySchema = z.object({ rating: z.nativeEnum(CommunityRating) });

/** POST `/community/reviews/[claimId]/rate` `{ rating }` — the author's one-time verdict on a review. */
async function rateReview(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { claimId } = validate(ParamsSchema, routeParams);
    const { rating } = validate(BodySchema, await req.json());
    await ReviewService.rateReview(claimId, user.id, rating);
    return SuccessNoContent();
}

export const POST = apiHandler(rateReview);
