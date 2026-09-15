/**
 * Apple in-app purchase, as the frontend sees it.
 *
 * The plans are sold through StoreKit on the App Store builds (iOS and macOS)
 * and through Stripe everywhere else. This module is the only place that
 * touches the store plugin, and it is imported lazily so the web bundle never
 * loads it. The plugin is compiled into the Apple binaries only (see
 * src-tauri/Cargo.toml).
 */

import { isTauri } from "@tauri-apps/api/core";
import { isIOS } from "./utils/platform";
import { appleProductId, Period, PERIODS, Plan, planForAppleProduct } from "./plans";

/** Where an App Store subscription is cancelled or resumed — Apple owns that UI. */
export const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

/**
 * True inside the App Store builds. macOS is distributed through the App
 * Store only, so any Tauri shell on a Mac is one; on iPadOS the user agent
 * reads as a Mac, which `isIOS` already accounts for.
 */
export const isAppleStoreBuild = (): boolean =>
    isTauri() && (isIOS() || (typeof navigator !== "undefined" && /Macintosh/.test(navigator.userAgent)));

/** This build's bundle id — the product ids are derived from it, so staging and production never collide. */
const bundleId = async () => (await import("@tauri-apps/api/app")).getIdentifier();

/** Localized prices of a plan per period, as the store shows them ("4,99 €"). */
export const getApplePrices = async (plan: Plan): Promise<Partial<Record<Period, string>>> => {
    const { getProducts } = await import("@choochmeque/tauri-plugin-iap-api");
    const id = await bundleId();
    const { products } = await getProducts(PERIODS.map((period) => appleProductId(id, plan, period)), "subs");
    const prices: Partial<Record<Period, string>> = {};
    for (const period of PERIODS) {
        const price = products.find((p) => p.productId === appleProductId(id, plan, period))?.formattedPrice;
        if (price) prices[period] = price;
    }
    return prices;
};

/**
 * Run the StoreKit purchase sheet for a plan and hand back the signed
 * transaction. `null` when the user dismissed the sheet or the purchase is
 * still pending (Ask to Buy) — nothing to link yet in either case.
 *
 * The app account token ties the purchase to this account on Apple's side:
 * it comes back on every renewal notification, which lets the server resolve
 * the user even if the link request below never reached it.
 */
export const purchaseApplePlan = async (plan: Plan, period: Period, userId: string): Promise<string | null> => {
    const { purchase, PurchaseState } = await import("@choochmeque/tauri-plugin-iap-api");
    try {
        const result = await purchase(appleProductId(await bundleId(), plan, period), "subs", { appAccountToken: userId });
        return result.purchaseState === PurchaseState.PURCHASED ? (result.jwsRepresentation ?? null) : null;
    } catch (err) {
        // The plugin rejects, rather than resolves, when the user dismisses the
        // sheet or the purchase awaits approval; neither is a failure.
        if (/cancelled|pending/i.test(String(err))) return null;
        throw err;
    }
};

/**
 * The signed transactions of every plan the device's Apple ID currently
 * holds, keyed by plan. StoreKit only ever returns transactions for the
 * signed-in Apple ID, so possessing these is what proves to the server that
 * the caller is the paying Apple account.
 */
export const restoreApplePlans = async (): Promise<Partial<Record<Plan, string>>> => {
    const { restorePurchases, PurchaseState } = await import("@choochmeque/tauri-plugin-iap-api");
    const id = await bundleId();
    const { purchases } = await restorePurchases("subs");
    const found: Partial<Record<Plan, string>> = {};
    for (const p of purchases) {
        const plan = planForAppleProduct(id, p.productId);
        if (plan && p.purchaseState === PurchaseState.PURCHASED && p.jwsRepresentation) found[plan] = p.jwsRepresentation;
    }
    return found;
};
