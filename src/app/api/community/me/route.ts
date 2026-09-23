import { NextRequest } from "next/server";

import * as TicketService from "@src/server/service/community-ticket-service";
import * as ReviewService from "@src/server/service/community-review-service";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success } from "@src/lib/utils/api-utils";

/**
 * GET `/community/me`
 *
 * What the Community pages need to decide what to show: the eligibility
 * verdict, and the profile, balance and active claim of a member. A verified
 * user without a profile gets one here, with the starter tickets, so opening
 * Community is all it takes to join; an account too recent is a member too,
 * only kept from submitting to Coverage until `eligibleAt`.
 */
async function getMe(req: NextRequest, { user }: AuthApiContext) {
    const now = new Date();
    const eligibility = await TicketService.getUserEligibility(user.id, now);
    let profile = await TicketService.getProfile(user.id);
    if (!profile) {
        if (eligibility.reason === "UNVERIFIED") return Success({ profile: null, eligibility, balance: 0, activeClaim: null });
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
        eligibility,
        balance,
        activeClaim,
    });
}

export const GET = apiHandler(getMe);
