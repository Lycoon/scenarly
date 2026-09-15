import { NextRequest } from "next/server";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { PlanBodySchema } from "@src/lib/utils/api-bodies";
import * as SubscriptionService from "@src/server/service/subscription-service";

/** Stop the plan's Stripe subscription at the end of the paid period. */
async function cancelSubscription(req: NextRequest, { user }: AuthApiContext) {
    const { plan } = validate(PlanBodySchema, await req.json().catch(() => ({})));
    await SubscriptionService.setStripeAutoRenew(user.id, plan, false);
    return Success(null);
}

export const POST = apiHandler(cancelSubscription);
