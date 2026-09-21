import { NextRequest } from "next/server";

import * as CreditService from "@src/server/service/community-credit-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const QuerySchema = z.object({
    cursor: z.string().optional(),
});

/** GET `/community/credits?cursor=` — the ledger, newest first, plus the balance. */
async function listCredits(req: NextRequest, { user, searchParams }: AuthApiContext) {
    const { cursor } = validate(QuerySchema, searchParams);
    await CreditService.requireProfile(user.id);
    const [entries, balance] = await Promise.all([
        CreditService.listCredits(user.id, 50, cursor),
        CreditService.getBalance(user.id),
    ]);
    return Success({ balance, entries, nextCursor: entries.length === 50 ? entries[entries.length - 1].id : null });
}

export const GET = apiHandler(listCredits);
