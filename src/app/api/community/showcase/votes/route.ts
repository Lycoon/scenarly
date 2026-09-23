import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { SHOWCASE_PAGE_SIZE } from "@src/lib/community/constants";

import z from "zod";

const QuerySchema = z.object({
    ids: z
        .string()
        .transform((s) => [...new Set(s.split(",").filter(Boolean))])
        .pipe(z.array(z.string()).min(1).max(SHOWCASE_PAGE_SIZE)),
});

/**
 * GET `/community/showcase/votes?ids=a,b,c`
 *
 * The signed-in viewer's side of entries rendered from a cached page: fresh
 * upvote counts and which of them they upvoted. Unpublished ids are left out.
 */
async function getVotes(req: NextRequest, { user, searchParams }: AuthApiContext) {
    const { ids } = validate(QuerySchema, searchParams);
    return Success(await ShowcaseService.getVotes(user.id, ids));
}

export const GET = apiHandler(getVotes);
