import { NextRequest } from "next/server";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { apiHandler, ApiContext } from "@src/lib/utils/api-handler";
import { Success } from "@src/lib/utils/api-utils";
import { parseShowcaseQuery } from "@src/lib/community/showcase";

/**
 * GET `/community/public/showcase?sort=top|new&kind=&page=`
 *
 * One page (24) of the wall. `top` ranks by a time-decayed upvote score,
 * `new` by publication date. `kind` is `full-script`, `pilot`, `short` or
 * `logline`. Unknown values fall back to the defaults. Public.
 */
async function listShowcase(req: NextRequest, { searchParams }: ApiContext) {
    return Success(await ShowcaseService.listWall(parseShowcaseQuery(searchParams)));
}

export const GET = apiHandler(listShowcase);
