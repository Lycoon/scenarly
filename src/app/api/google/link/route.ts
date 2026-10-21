import { NextRequest, NextResponse } from "next/server";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { BodyFieldError, ForbiddenError, Success } from "@src/lib/utils/api-utils";
import { getGooglePurchase } from "@src/lib/google-play";
import { isGoogleEntitled } from "@src/lib/google-play-purchase";
import { planForGoogleProduct } from "@src/lib/plans";
import { logger } from "@src/lib/utils/logger";
import * as SubscriptionService from "@src/server/service/subscription-service";

/**
 * POST `/api/google/link`
 *
 * Attach the Google Play subscription behind a purchase token to the calling
 * account. The app sends it right after a purchase, and from Restore
 * Purchases; both read it from Play Billing for the device's Google account,
 * so holding it is what proves the caller is the paying Google account. The
 * token is checked with Google under this server's package name, which also
 * says which plan it grants.
 *
 * 409 with `data.ownerEmail` means the subscription already backs another
 * account's live plan; the app shows which one so the user can sign in there.
 */
async function linkGooglePurchase(req: NextRequest, { user }: AuthApiContext) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.purchaseToken !== "string" || !body.purchaseToken) throw new BodyFieldError("Missing purchaseToken");

    const purchase = await getGooglePurchase(body.purchaseToken);
    const plan = planForGoogleProduct(purchase.productId);
    if (!plan) throw new ForbiddenError("Purchase is for an unknown product");
    if (!isGoogleEntitled(purchase)) throw new ForbiddenError("Subscription is not active");

    const result = await SubscriptionService.linkGoogle(user.id, plan, purchase);
    if (!result.ok) {
        return NextResponse.json(
            { status: "error", message: "Subscription is linked to another account", data: { plan, ownerEmail: result.ownerEmail } },
            { status: 409 },
        );
    }

    logger.info("[Google link] Plan granted", { userId: user.id, plan, state: purchase.state, test: purchase.test });
    return Success({ plan });
}

export const POST = apiHandler(linkGooglePurchase);
