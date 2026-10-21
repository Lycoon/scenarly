/**
 * A Google Play subscription as the billing code sees it, read from the Play
 * Developer API's `purchases.subscriptionsv2` resource (see google-play.ts,
 * which fetches it). Kept free of server imports so it can be tested alone.
 */

/** `SUBSCRIPTION_STATE_*`, without the prefix. */
export type GoogleSubscriptionState =
    | "PENDING"
    | "ACTIVE"
    | "PAUSED"
    | "IN_GRACE_PERIOD"
    | "ON_HOLD"
    | "CANCELED"
    | "EXPIRED"
    | "PENDING_PURCHASE_CANCELED"
    | "UNSPECIFIED";

/** The subscription fields the billing code relies on. */
export interface GooglePurchase {
    purchaseToken: string;
    productId: string;
    state: GoogleSubscriptionState;
    /** Milliseconds since epoch; absent while the purchase is pending. */
    expiresAt?: number;
    autoRenewing: boolean;
    acknowledged: boolean;
    /** The id we passed as `obfuscatedAccountId` at purchase time — the buying user's id. */
    accountId?: string;
    /** The token this one replaced, on an upgrade, downgrade or resubscribe. */
    linkedPurchaseToken?: string;
    /** Bought by a license tester: nothing was charged. */
    test: boolean;
}

/** The parts of a `subscriptionsv2` resource read here. */
export type SubscriptionPurchaseV2 = {
    subscriptionState?: string;
    acknowledgementState?: string;
    linkedPurchaseToken?: string;
    testPurchase?: object;
    externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
    lineItems?: { productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }[];
};

/** Read a `subscriptionsv2` resource into what the billing code needs; null when it names no product. */
export function parseSubscription(purchaseToken: string, body: SubscriptionPurchaseV2): GooglePurchase | null {
    // One line item per product; ours sell one product per subscription.
    const item = body.lineItems?.[0];
    if (!item?.productId) return null;
    const state = (body.subscriptionState ?? "").replace(/^SUBSCRIPTION_STATE_/, "") as GoogleSubscriptionState;
    return {
        purchaseToken,
        productId: item.productId,
        state: state || "UNSPECIFIED",
        expiresAt: item.expiryTime ? Date.parse(item.expiryTime) : undefined,
        autoRenewing: item.autoRenewingPlan?.autoRenewEnabled === true,
        acknowledged: body.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        accountId: body.externalAccountIdentifiers?.obfuscatedExternalAccountId,
        linkedPurchaseToken: body.linkedPurchaseToken,
        test: body.testPurchase !== undefined,
    };
}

/**
 * Whether the subscription grants its plan right now. A cancelled one runs
 * to the end of the period it paid for, and one in its grace period keeps
 * access while Google retries the payment (Google moves `expiryTime` to the
 * end of the grace period meanwhile). On hold, paused, expired and pending
 * do not.
 */
export const isGoogleEntitled = (purchase: GooglePurchase, now = Date.now()): boolean =>
    (purchase.state === "ACTIVE" || purchase.state === "CANCELED" || purchase.state === "IN_GRACE_PERIOD") &&
    !!purchase.expiresAt &&
    purchase.expiresAt > now;
