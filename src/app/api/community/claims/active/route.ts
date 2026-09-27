import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success } from "@src/lib/utils/api-utils";

/** GET `/community/claims/active` — the claim in progress with its draft, or null. */
async function getActiveClaim(req: NextRequest, { user }: AuthApiContext) {
    return Success({ claim: await ReviewService.getActiveClaim(user.id) });
}

export const GET = apiHandler(getActiveClaim);
