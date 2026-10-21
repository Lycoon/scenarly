/**
 * Google Play in-app purchase, as the frontend sees it.
 *
 * The plans are sold through Play Billing on the Android build, the one
 * distributed through Google Play. Like apple-iap, this module is the only
 * place that touches the store plugin for Play, and it is imported lazily so
 * the web bundle never loads it. Each plan is one Play subscription product
 * whose periods are its base plans (see `googleProductId`).
 */

import { isTauri } from "@tauri-apps/api/core";
import type { SubscriptionOffer } from "@choochmeque/tauri-plugin-iap-api";
import { isAndroid } from "./utils/platform";
import { GOOGLE_BASE_PLAN_IDS, googleProductId, Period, PERIODS, Plan, planForGoogleProduct } from "./plans";

/** True inside the Android app, which is distributed through Google Play only. */
export const isPlayStoreBuild = (): boolean => isTauri() && isAndroid();

/** Where a Play subscription is cancelled or resumed — Google owns that UI. */
export const GOOGLE_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions";

/**
 * The base offer of a period's base plan: the one without an offer id, at
 * the price shown on the button. Promotional offers, if any are ever set up
 * in the Play Console, are not picked silently.
 */
const baseOffer = (offers: SubscriptionOffer[] | undefined, period: Period) =>
    offers?.find((offer) => offer.basePlanId === GOOGLE_BASE_PLAN_IDS[period] && !offer.offerId);

const getOffers = async (plan: Plan) => {
    const { getProducts } = await import("@choochmeque/tauri-plugin-iap-api");
    const { products } = await getProducts([googleProductId(plan)], "subs");
    return products.find((p) => p.productId === googleProductId(plan))?.subscriptionOfferDetails;
};

/** Localized prices of a plan per period, as Google Play shows them ("4,99 €"). */
export const getGooglePrices = async (plan: Plan): Promise<Partial<Record<Period, string>>> => {
    const offers = await getOffers(plan);
    const prices: Partial<Record<Period, string>> = {};
    for (const period of PERIODS) {
        // The recurring phase is the last one, after any trial or intro price.
        const price = baseOffer(offers, period)?.pricingPhases.at(-1)?.formattedPrice;
        if (price) prices[period] = price;
    }
    return prices;
};

/**
 * Run the Play purchase sheet for a plan and hand back the purchase token.
 * `null` when the user dismissed the sheet or the payment is still pending
 * (a cash payment, say) — nothing to link yet; Google's notification grants
 * the plan once it is paid.
 *
 * The obfuscated account id ties the purchase to this account on Google's
 * side: it comes back with the subscription on every notification, which
 * lets the server resolve the user even if the link request never reached it.
 */
export const purchaseGooglePlan = async (plan: Plan, period: Period, userId: string): Promise<string | null> => {
    const { purchase, PurchaseState } = await import("@choochmeque/tauri-plugin-iap-api");
    const offer = baseOffer(await getOffers(plan), period);
    if (!offer) throw new Error(`No ${period} base plan for ${plan} in Google Play`);
    try {
        const result = await purchase(googleProductId(plan), "subs", { offerToken: offer.offerToken, obfuscatedAccountId: userId });
        return result.purchaseState === PurchaseState.PURCHASED ? result.purchaseToken : null;
    } catch (err) {
        // The plugin rejects, rather than resolves, when the user dismisses the
        // sheet or the payment is pending; neither is a failure.
        if (/cancel|pending/i.test(String(err))) return null;
        throw err;
    }
};

/**
 * The purchase tokens of every plan the device's Google account currently
 * holds, keyed by plan. Play Billing only returns purchases of the signed-in
 * Google account, so possessing these is what proves to the server that the
 * caller is the paying account.
 */
export const restoreGooglePlans = async (): Promise<Partial<Record<Plan, string>>> => {
    const { restorePurchases, PurchaseState } = await import("@choochmeque/tauri-plugin-iap-api");
    const { purchases } = await restorePurchases("subs");
    const found: Partial<Record<Plan, string>> = {};
    for (const p of purchases) {
        const plan = planForGoogleProduct(p.productId);
        if (plan && p.purchaseState === PurchaseState.PURCHASED) found[plan] = p.purchaseToken;
    }
    return found;
};
