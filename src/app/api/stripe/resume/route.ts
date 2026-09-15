import { NextRequest } from "next/server";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { PlanBodySchema } from "@src/lib/utils/api-bodies";
import * as SubscriptionService from "@src/server/service/subscription-service";

/**
 * Undo a cancel-at-period-end on the plan's Stripe subscription while it is
 * still running. Reactivating through a new checkout instead would open a
 * second subscription alongside the one that has not ended yet.
 */
async function resumeSubscription(req: NextRequest, { user }: AuthApiContext) {
    const { plan } = validate(PlanBodySchema, await req.json().catch(() => ({})));
    await SubscriptionService.setStripeAutoRenew(user.id, plan, true);
    return Success(null);
}

export const POST = apiHandler(resumeSubscription);
