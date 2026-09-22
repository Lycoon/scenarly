import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { SuccessCreated, validate } from "@src/lib/utils/api-utils";
import { PEN_NAME_MAX_LENGTH, PEN_NAME_MIN_LENGTH } from "@src/lib/community/constants";

import z from "zod";

const BodySchema = z.object({
    penName: z.string().trim().min(PEN_NAME_MIN_LENGTH).max(PEN_NAME_MAX_LENGTH),
});

/**
 * POST `/community/join`
 *
 * Creates the Community profile and grants the starter tickets. 403
 * `NOT_ELIGIBLE` while the entry gate fails, 409 when already a member.
 */
async function join(req: NextRequest, { user }: AuthApiContext) {
    const { penName } = validate(BodySchema, await req.json());
    const profile = await TicketService.join(user.id, penName);
    return SuccessCreated({ penName: profile.penName, createdAt: profile.createdAt });
}

export const POST = apiHandler(join);
