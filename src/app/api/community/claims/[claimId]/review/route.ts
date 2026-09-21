import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ claimId: z.string() });
const BodySchema = z.object({
    worksWell: z.string().max(20000).default(""),
    doesNotWork: z.string().max(20000).default(""),
    remarks: z.string().max(20000).default(""),
    signed: z.boolean().default(false),
});

/** PUT `/community/claims/[claimId]/review` — save the draft; returns the server's word count. */
async function saveDraft(req: NextRequest, { user, routeParams }: AuthApiContext) {
    const { claimId } = validate(ParamsSchema, routeParams);
    const draft = validate(BodySchema, await req.json());
    return Success(await ReviewService.saveDraft(claimId, user.id, draft));
}

export const PUT = apiHandler(saveDraft);
