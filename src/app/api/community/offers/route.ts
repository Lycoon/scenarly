import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success } from "@src/lib/utils/api-utils";

/**
 * GET `/community/offers`
 *
 * The reviewer's current set of 5 (title, logline, genres, format, pages —
 * never the author). Persisted, so a reload shows the same set. 409
 * `HAS_ACTIVE_CLAIM` while a review is in progress.
 */
async function getOffers(req: NextRequest, { user }: AuthApiContext) {
    return Success(await ReviewService.getOffers(user.id));
}

export const GET = apiHandler(getOffers);
