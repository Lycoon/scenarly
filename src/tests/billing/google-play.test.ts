import { describe, expect, it } from "vitest";
import { isGoogleEntitled, parseSubscription } from "@src/lib/google-play-purchase";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const LATER = "2026-11-21T12:00:00Z";
const EARLIER = "2026-10-20T12:00:00Z";

const subscription = (state: string, expiryTime = LATER, extra: object = {}) => ({
    subscriptionState: `SUBSCRIPTION_STATE_${state}`,
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{ productId: "cloud", expiryTime, autoRenewingPlan: { autoRenewEnabled: true } }],
    ...extra,
});

describe("parseSubscription", () => {
    it("reads what the billing code relies on", () => {
        const purchase = parseSubscription(
            "token",
            subscription("ACTIVE", LATER, {
                linkedPurchaseToken: "old-token",
                externalAccountIdentifiers: { obfuscatedExternalAccountId: "user-id" },
                testPurchase: {},
            }),
        );
        expect(purchase).toEqual({
            purchaseToken: "token",
            productId: "cloud",
            state: "ACTIVE",
            expiresAt: Date.parse(LATER),
            autoRenewing: true,
            acknowledged: false,
            accountId: "user-id",
            linkedPurchaseToken: "old-token",
            test: true,
        });
    });

    it("reads a cancelled subscription as not renewing", () => {
        const purchase = parseSubscription("token", {
            ...subscription("CANCELED"),
            lineItems: [{ productId: "cloud", expiryTime: LATER, autoRenewingPlan: { autoRenewEnabled: false } }],
        });
        expect(purchase?.autoRenewing).toBe(false);
        expect(purchase?.test).toBe(false);
    });

    it("refuses a subscription without a product", () => {
        expect(parseSubscription("token", { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" })).toBeNull();
    });
});

describe("isGoogleEntitled", () => {
    const entitled = (state: string, expiryTime?: string) =>
        isGoogleEntitled(parseSubscription("token", subscription(state, expiryTime))!, NOW);

    it("grants the plan while active, cancelled or in grace, until expiry", () => {
        expect(entitled("ACTIVE")).toBe(true);
        expect(entitled("CANCELED")).toBe(true);
        expect(entitled("IN_GRACE_PERIOD")).toBe(true);
    });

    it("does not grant it past expiry", () => {
        expect(entitled("ACTIVE", EARLIER)).toBe(false);
        expect(entitled("CANCELED", EARLIER)).toBe(false);
    });

    it("does not grant it on hold, paused, expired or pending", () => {
        for (const state of ["ON_HOLD", "PAUSED", "EXPIRED", "PENDING", "PENDING_PURCHASE_CANCELED"]) {
            expect(entitled(state)).toBe(false);
        }
    });
});
