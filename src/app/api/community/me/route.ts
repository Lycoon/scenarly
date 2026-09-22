import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { PEN_NAME_MAX_LENGTH, PEN_NAME_MIN_LENGTH } from "@src/lib/community/constants";

import z from "zod";

const PatchSchema = z.object({
    penName: z.string().trim().min(PEN_NAME_MIN_LENGTH).max(PEN_NAME_MAX_LENGTH),
});

/**
 * GET `/community/me`
 *
 * What the Coverage pages need to decide what to show: the entry gate verdict
 * for a user who has not joined, or the profile, balance and active claim of
 * a member.
 */
async function getMe(req: NextRequest, { user }: AuthApiContext) {
    const now = new Date();
    const profile = await TicketService.getProfile(user.id);
    if (!profile) {
        const eligibility = await TicketService.getUserEligibility(user.id, now);
        return Success({ profile: null, eligibility, balance: 0, activeClaim: null });
    }

    const [balance, activeClaim] = await Promise.all([
        TicketService.getBalance(user.id),
        ReviewService.getActiveClaim(user.id, now),
    ]);
    return Success({
        profile: {
            penName: profile.penName,
            createdAt: profile.createdAt,
            reviewsCompleted: profile.reviewsCompleted,
            usefulCount: profile.usefulCount,
            notUsefulCount: profile.notUsefulCount,
        },
        eligibility: { ok: true },
        balance,
        activeClaim,
    });
}

/** PATCH `/community/me` — change the pen name. */
async function patchMe(req: NextRequest, { user }: AuthApiContext) {
    const { penName } = validate(PatchSchema, await req.json());
    await TicketService.requireProfile(user.id);
    const profile = await TicketService.updatePenName(user.id, penName);
    return Success({ penName: profile.penName });
}

export const GET = apiHandler(getMe);
export const PATCH = apiHandler(patchMe);
