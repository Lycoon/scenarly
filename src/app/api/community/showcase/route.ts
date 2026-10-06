import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessCreated, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const BodySchema = z.object({
    submissionId: z.string(),
});

/**
 * POST `/community/showcase` `{ submissionId }`
 *
 * Put one of the caller's submissions on Showcase, or back on it, as the kind
 * its format is shown as (FULL_KIND_BY_FORMAT). 201 with the slug; 409
 * `ALREADY_PUBLISHED`.
 */
async function publish(req: NextRequest, { user }: AuthApiContext) {
    const { submissionId } = validate(BodySchema, await req.json());
    return SuccessCreated(await ShowcaseService.publish(submissionId, user.id));
}

export const POST = apiHandler(publish);
