import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { getCookieUser } from "@src/lib/session";
import { apiHandler, ApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const ParamsSchema = z.object({ slug: z.string().max(200) });

/**
 * GET `/community/public/showcase/[slug]`
 *
 * A published entry, plus `viewerHasUpvoted` when the request carries a
 * session. Public: the proxy lets it through without resolving a user, so the
 * session is read here, not from `context.user`.
 */
async function getEntry(req: NextRequest, { routeParams }: ApiContext) {
    const { slug } = validate(ParamsSchema, routeParams);
    const viewer = await getCookieUser();
    return Success(await ShowcaseService.getBySlugForViewer(slug, viewer?.id ?? null));
}

export const GET = apiHandler(getEntry);
