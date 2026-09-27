import { NextRequest } from "next/server";

import * as SubmissionService from "@src/server/service/community-submission-service";
import { apiHandler, ApiContext } from "@src/lib/utils/api-handler";
import { NotFoundError, Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/i) });

/**
 * GET `/community/public/proof/[sha256]`
 *
 * Proof of prior existence: when a file with this hash was first submitted.
 * Public and unauthenticated (allow-listed in the proxy); it discloses nothing
 * about the file beyond the fact that it was registered.
 */
async function getProof(req: NextRequest, { routeParams }: ApiContext) {
    const { sha256 } = validate(ParamsSchema, routeParams);
    const registeredAt = await SubmissionService.getProof(sha256.toLowerCase());
    if (!registeredAt) throw new NotFoundError("No submission with this hash");
    return Success({ sha256: sha256.toLowerCase(), registeredAt });
}

export const GET = apiHandler(getProof);
