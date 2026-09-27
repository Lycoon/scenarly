import { NextRequest } from "next/server";
import z from "zod";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { WithdrawBodySchema } from "@src/lib/utils/api-bodies";
import { PLANS } from "@src/lib/plans";
import * as SubscriptionService from "@src/server/service/subscription-service";

const QuerySchema = z.object({
    plan: z.enum(PLANS),
    locale: z.string().trim().min(2).max(10).optional(),
});

/** The refund a withdrawal would bring and until when it is open; null outside the 14 days. */
async function getWithdrawal(_req: NextRequest, { user, searchParams }: AuthApiContext) {
    const { plan, locale } = validate(QuerySchema, searchParams);
    return Success(await SubscriptionService.getStripeWithdrawal(user.id, plan, locale ?? "en"));
}

/** Exercise the 14-day right of withdrawal: the plan ends now and the unused days are refunded. */
async function withdraw(req: NextRequest, { user }: AuthApiContext) {
    const { plan, locale } = validate(WithdrawBodySchema, await req.json().catch(() => ({})));
    return Success(await SubscriptionService.withdrawStripe(user.id, plan, locale ?? "en"));
}

export const GET = apiHandler(getWithdrawal);
export const POST = apiHandler(withdraw);
