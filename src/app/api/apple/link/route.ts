import { NextRequest, NextResponse } from "next/server";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { BodyFieldError, ForbiddenError, Success } from "@src/lib/utils/api-utils";
import { verifyAppleTransaction } from "@src/lib/apple-jws";
import { planForAppleProduct } from "@src/lib/plans";
import { logger } from "@src/lib/utils/logger";
import * as SubscriptionService from "@src/server/service/subscription-service";

/**
 * POST `/api/apple/link`
 *
 * Attach the App Store subscription in the signed transaction to the calling
 * account. The app sends it right after a purchase, and from Restore
 * Purchases; both hand over the JWS StoreKit produced for the device's Apple
 * ID, so holding it is what proves the caller is the paying Apple account.
 * Which plan it grants follows from the product id inside the transaction;
 * the bundle id and store environment are checked by the verifier itself.
 *
 * 409 with `data.ownerEmail` means the subscription already backs another
 * account's live plan; the app shows which one so the user can sign in there.
 */
async function linkApplePurchase(req: NextRequest, { user }: AuthApiContext) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.jwsTransaction !== "string") throw new BodyFieldError("Missing jwsTransaction");

    const tx = await verifyAppleTransaction(body.jwsTransaction);
    const plan = planForAppleProduct(tx.bundleId, tx.productId);
    if (!plan) throw new ForbiddenError("Transaction is for an unknown product");
    if (tx.revocationDate || !tx.expiresDate || tx.expiresDate <= Date.now()) {
        throw new ForbiddenError("Subscription is not active");
    }

    const result = await SubscriptionService.linkApple(user.id, plan, tx);
    if (!result.ok) {
        return NextResponse.json(
            { status: "error", message: "Subscription is linked to another account", data: { plan, ownerEmail: result.ownerEmail } },
            { status: 409 },
        );
    }

    logger.info("[Apple link] Plan granted", {
        userId: user.id,
        plan,
        originalTransactionId: tx.originalTransactionId,
        environment: tx.environment,
    });
    return Success({ plan });
}

export const POST = apiHandler(linkApplePurchase);
