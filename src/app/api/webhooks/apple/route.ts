import { NextRequest, NextResponse } from "next/server";
import { AppleVerificationError, verifyAppleNotification } from "@src/lib/apple-jws";
import { logger } from "@src/lib/utils/logger";
import * as SubscriptionService from "@src/server/service/subscription-service";

/**
 * App Store Server Notifications V2.
 * https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
 *
 * Every notification carries the latest signed transaction, so the handling
 * reduces to: does the subscription still run, until when, and will it renew.
 * Anything we do not care about (price consent, consumption requests, the
 * TEST ping from App Store Connect) is acknowledged untouched — Apple retries
 * anything that is not answered 200, which is also why a verification that
 * could not run (rather than one that failed) answers 503.
 */
export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => ({}))) as { signedPayload?: string };
    if (!body.signedPayload) return NextResponse.json({ error: "Missing signedPayload" }, { status: 400 });

    let type: string, subtype: string | undefined, tx, renewal;
    try {
        ({ type, subtype, transaction: tx, renewal } = await verifyAppleNotification(body.signedPayload));
    } catch (e) {
        const status = e instanceof AppleVerificationError ? e.statusCode : 400;
        logger.warn("[Apple webhook] Rejected payload", { status, error: e });
        return NextResponse.json({ error: "Invalid payload" }, { status });
    }

    if (!tx) return NextResponse.json({ received: true });

    const subscriber = await SubscriptionService.getAppleSubscriber(tx);
    if (!subscriber) {
        logger.warn("[Apple webhook] No account for transaction", { type, originalTransactionId: tx.originalTransactionId });
        return NextResponse.json({ received: true });
    }

    switch (type) {
        // A paid period started or was extended: (re)subscribe, renew, an
        // offer or a goodwill extension. Autorenew status rides along when
        // Apple included the renewal info.
        case "SUBSCRIBED":
        case "DID_RENEW":
        case "OFFER_REDEEMED":
        case "RENEWAL_EXTENDED":
        case "RENEWAL_EXTENSION":
            await SubscriptionService.grantApple(subscriber, tx, renewal?.autoRenewStatus === 0);
            break;

        case "DID_CHANGE_RENEWAL_STATUS":
            await SubscriptionService.setAppleAutoRenew(tx, renewal?.autoRenewStatus !== 0);
            break;

        // A failed renewal inside the billing grace period keeps access
        // until the grace period ends; outside it the plan simply runs out at
        // the expiry date already recorded.
        case "DID_FAIL_TO_RENEW":
            if (renewal?.gracePeriodExpiresDate) {
                await SubscriptionService.extendApple(tx, new Date(renewal.gracePeriodExpiresDate));
            }
            break;

        case "EXPIRED":
        case "GRACE_PERIOD_EXPIRED":
        case "REVOKE":
        case "REFUND":
            await SubscriptionService.endApple(tx);
            break;
    }

    logger.info("[Apple webhook] Handled", { type, subtype, ...subscriber, environment: tx.environment });
    return NextResponse.json({ received: true });
}
