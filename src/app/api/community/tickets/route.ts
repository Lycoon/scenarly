import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";

import z from "zod";

const QuerySchema = z.object({
    cursor: z.string().optional(),
});

/** GET `/community/tickets?cursor=` — the ledger, newest first, plus the balance. */
async function listTickets(req: NextRequest, { user, searchParams }: AuthApiContext) {
    const { cursor } = validate(QuerySchema, searchParams);
    await TicketService.requireProfile(user.id);
    const [entries, balance] = await Promise.all([
        TicketService.listTickets(user.id, 50, cursor),
        TicketService.getBalance(user.id),
    ]);
    return Success({ balance, entries, nextCursor: entries.length === 50 ? entries[entries.length - 1].id : null });
}

export const GET = apiHandler(listTickets);
