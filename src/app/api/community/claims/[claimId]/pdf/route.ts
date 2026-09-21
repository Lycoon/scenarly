import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ claimId: z.string() });

/**
 * GET `/community/claims/[claimId]/pdf`
 *
 * Short-lived inline URL of the reviewer's watermarked copy, stamped on the
 * first call. 410 once the claim has ended.
 */
async function getClaimPdf(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { claimId } = validate(ParamsSchema, routeParams);
    return Success(await ReviewService.getClaimPdfUrl(claimId, user.id));
}

export const GET = apiHandler(getClaimPdf);
