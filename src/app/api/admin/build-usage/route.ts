import { NextRequest } from "next/server";
import z from "zod";

import * as BuildUsageService from "@src/server/service/build-usage-service";
import { Success, validate } from "@src/lib/utils/api-utils";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { assertAdmin } from "@src/lib/utils/admin-guard";

const QuerySchema = z.object({
    range: z.enum(BuildUsageService.USAGE_RANGES).default("7d"),
});

async function getBuildUsage(req: NextRequest, { searchParams, user }: AuthApiContext) {
    await assertAdmin(user);

    const { range } = validate(QuerySchema, searchParams);
    const rows = await BuildUsageService.getBuildUsage(range);

    return Success({ range, rows });
}

export const GET = apiHandler(getBuildUsage);
