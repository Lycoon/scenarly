import { NextRequest, NextResponse } from "next/server";
import { GooglePlayError, isGooglePushAuthentic, PACKAGE_NAME } from "@src/lib/google-play";
import { logger } from "@src/lib/utils/logger";
import * as SubscriptionService from "@src/server/service/subscription-service";

type DeveloperNotification = {
    packageName?: string;
    subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
    voidedPurchaseNotification?: { purchaseToken?: string; productType?: number };
    testNotification?: object;
};

/** `voidedPurchaseNotification.productType` of a subscription (2 is a one-time product). */
const VOIDED_SUBSCRIPTION = 1;

/**
 * Google Play real-time developer notifications, pushed by Cloud Pub/Sub.
 * https://developer.android.com/google/play/billing/rtdn-reference
 *
 * A notification only says that a subscription changed, so every kind
 * (purchased, renewed, cancelled, restarted, in grace, on hold, paused,
 * expired, revoked...) reduces to reading it fresh from Google and mirroring
 * that. A voided purchase — refunded or charged back — ends the plan at once.
 *
 * Pub/Sub redelivers anything not answered 2xx, which is why a check that
 * could not run answers 503; anything we do not act on (the Play Console's
 * test notification, another app's, one-time products) is acknowledged as is.
 */
export async function POST(req: NextRequest) {
    if (!(await isGooglePushAuthentic(req.headers.get("authorization")))) {
        logger.warn("[Google webhook] Rejected push: not from our Pub/Sub subscription");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { message?: { data?: string } };
    let notification: DeveloperNotification;
    try {
        notification = JSON.parse(Buffer.from(body.message?.data ?? "", "base64").toString()) as DeveloperNotification;
    } catch {
        logger.warn("[Google webhook] Unreadable notification");
        return NextResponse.json({ received: true });
    }

    if (notification.packageName !== PACKAGE_NAME) {
        logger.warn("[Google webhook] Notification for another app", { packageName: notification.packageName });
        return NextResponse.json({ received: true });
    }

    const { subscriptionNotification: changed, voidedPurchaseNotification: voided } = notification;
    try {
        if (changed?.purchaseToken) {
            const subscriber = await SubscriptionService.syncGoogle(changed.purchaseToken);
            if (subscriber) logger.info("[Google webhook] Handled", { type: changed.notificationType, ...subscriber });
            else logger.warn("[Google webhook] No account for subscription", { type: changed.notificationType });
        } else if (voided?.purchaseToken && voided.productType === VOIDED_SUBSCRIPTION) {
            await SubscriptionService.endGoogle(voided.purchaseToken);
            logger.info("[Google webhook] Voided purchase handled");
        }
    } catch (e) {
        const status = e instanceof GooglePlayError ? e.statusCode : 500;
        logger.error("[Google webhook] Failed to handle notification", { status, error: e });
        // A token Google no longer knows will not improve on redelivery.
        if (status === 403) return NextResponse.json({ received: true });
        return NextResponse.json({ error: "Could not handle notification" }, { status: 503 });
    }

    return NextResponse.json({ received: true });
}
