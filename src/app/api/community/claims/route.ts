import { NextRequest } from "next/server";

import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, SuccessCreated, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const BodySchema = z.object({ submissionId: z.string() });
const QuerySchema = z.object({ cursor: z.string().optional() });

/** GET `/community/claims?cursor=` — the reviewer's ended claims with their reviews and ratings. */
async function listClaims(req: NextRequest, { user, searchParams }: AuthApiContext) {
    const { cursor } = validate(QuerySchema, searchParams);
    const claims = await ReviewService.listEndedClaims(user.id, 20, cursor);
    return Success({ claims, nextCursor: claims.length === 20 ? claims[claims.length - 1].id : null });
}

/**
 * POST `/community/claims` `{ submissionId }`
 *
 * Claim one of the offered scripts. 409 `HAS_ACTIVE_CLAIM` or `NOT_OFFERED`.
 */
async function createClaim(req: NextRequest, { user }: AuthApiContext) {
    const { submissionId } = validate(BodySchema, await req.json());
    return SuccessCreated(await ReviewService.claim(user.id, submissionId));
}

export const GET = apiHandler(listClaims);
export const POST = apiHandler(createClaim);
