import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success } from "@src/lib/utils/api-utils";

/**
 * GET `/community/me`
 *
 * What the Coverage pages need to decide what to show: the entry gate verdict
 * for a user who fails it, or the profile, balance and active claim of a
 * member. An eligible user without a profile gets one here, with the starter
 * tickets, so opening Coverage is all it takes to join.
 */
async function getMe(req: NextRequest, { user }: AuthApiContext) {
    const now = new Date();
    let profile = await TicketService.getProfile(user.id);
    if (!profile) {
        const eligibility = await TicketService.getUserEligibility(user.id, now);
        if (!eligibility.ok) return Success({ profile: null, eligibility, balance: 0, activeClaim: null });
        profile = await TicketService.createProfile(user.id);
    }

    const [balance, activeClaim] = await Promise.all([
        TicketService.getBalance(user.id),
        ReviewService.getActiveClaim(user.id, now),
    ]);
    return Success({
        profile: {
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

export const GET = apiHandler(getMe);
