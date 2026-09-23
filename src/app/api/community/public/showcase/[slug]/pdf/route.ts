import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, ApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ slug: z.string().max(200) });

/**
 * GET `/community/public/showcase/[slug]/pdf`
 *
 * Short-lived inline URL of a published entry's PDF, unwatermarked. 404 for a
 * LOGLINE entry or one that is no longer published. Public.
 */
async function getEntryPdf(req: NextRequest, { routeParams }: ApiContext) {
    const { slug } = validate(ParamsSchema, routeParams);
    return Success(await ShowcaseService.getPublicPdfUrl(slug));
}

export const GET = apiHandler(getEntryPdf);
