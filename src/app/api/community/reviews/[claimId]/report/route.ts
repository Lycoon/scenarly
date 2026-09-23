import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessCreated, validate } from "@src/lib/utils/api-utils";
import { CommunityReportReason } from "@src/generated/client/client";

import z from "zod";

const ParamsSchema = z.object({ claimId: z.string() });
const BodySchema = z.object({
    reason: z.nativeEnum(CommunityReportReason),
    details: z.string().trim().max(2000).optional(),
});

/** POST `/community/reviews/[claimId]/report` — record a report for later; no moderation yet. */
async function reportReview(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { claimId } = validate(ParamsSchema, routeParams);
    const { reason, details } = validate(BodySchema, await req.json());
    const report = await ReviewService.reportReview(claimId, user.id, reason, details);
    return SuccessCreated({ id: report.id });
}

export const POST = apiHandler(reportReview);
