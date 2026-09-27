import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessCreated, validate } from "@src/lib/utils/api-utils";
import { CommunityShowcaseKind } from "@src/generated/client/client";

import z from "zod";

const BodySchema = z.object({
    submissionId: z.string(),
    kind: z.nativeEnum(CommunityShowcaseKind),
});

/**
 * POST `/community/showcase` `{ submissionId, kind }`
 *
 * Put one of the caller's submissions on Showcase, or back on it. `kind` must
 * fit the submission's format (its full-PDF kind, or LOGLINE). 201 with the
 * slug; 409 `ALREADY_PUBLISHED`.
 */
async function publish(req: NextRequest, { user }: AuthApiContext) {
    const { submissionId, kind } = validate(BodySchema, await req.json());
    return SuccessCreated(await ShowcaseService.publish(submissionId, user.id, kind));
}

export const POST = apiHandler(publish);
