import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success } from "@src/lib/utils/api-utils";

/** POST `/community/offers/reshuffle` — a new set, once per 24 h (429 `RESHUFFLE_COOLDOWN` otherwise). */
async function reshuffle(req: NextRequest, { user }: AuthApiContext) {
    return Success(await ReviewService.reshuffle(user.id));
}

export const POST = apiHandler(reshuffle);
