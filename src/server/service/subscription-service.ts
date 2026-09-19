/**
 * Plan entitlements, fed by two stores that must never bill one plan twice.
 *
 * Stripe bills the web and Windows apps; Apple bills the App Store builds
 * (iOS and macOS). Each plan a user holds is one Subscription row naming the
 * store that bills it, and every write goes through here so that:
 *
 *  - a store's event only ever reaches the row it created — events are
 *    resolved by (provider, providerId), so a late "expired" from Stripe
 *    cannot touch a plan the user has since bought from Apple, and vice versa;
 *  - the checkout and purchase entry points refuse to sell a plan the user
 *    already holds (`assertNotSubscribed`) instead of stacking one on the other;
 *  - the one race that can still slip through (both stores charged for the
 *    same plan before either settled) resolves in Apple's favour, because
 *    Apple's subscription is the one we cannot cancel from here: the Stripe
 *    one is set to stop at period end rather than bill on.
 *
 * Stripe and Apple remain the source of truth for money; the rows only mirror
 * enough of their state to gate features and to route their events.
 */

import Stripe from "stripe";
import { SubscriptionRepository } from "../repository/subscription-repository";
import * as UserService from "./user-service";
import { isSubscriptionActive, Period, PERIODS, Plan, planForAppleProduct, PLANS, PLANS_ON_SALE } from "@src/lib/plans";
import { ConflictError, ForbiddenError } from "@src/lib/utils/api-utils";
import { logger } from "@src/lib/utils/logger";
import type { AppleTransaction } from "@src/lib/apple-jws";

const repository = new SubscriptionRepository();

/** What a store event resolves to. */
export type Subscriber = { userId: string; plan: Plan };

let stripeClient: Stripe | undefined;
export const getStripe = () => (stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY!));

/** Stripe prices per plan and period; unset until sold. */
const STRIPE_PRICE_IDS: Record<Plan, Record<Period, string | undefined>> = {
    CLOUD: { MONTHLY: process.env.STRIPE_CLOUD_MONTHLY_PRICE_ID, YEARLY: process.env.STRIPE_CLOUD_YEARLY_PRICE_ID },
};

export const planForStripePrice = (priceId: string): Plan | null =>
    PLANS.find((plan) => Object.values(STRIPE_PRICE_IDS[plan]).includes(priceId)) ?? null;

export function stripePriceFor(plan: Plan, period: Period): string {
    const priceId = STRIPE_PRICE_IDS[plan][period];
    if (!priceId) throw new ForbiddenError(`${plan} has no ${period} Stripe price configured`);
    return priceId;
}

// Stripe amounts are in the currency's smallest unit, except these, which have none.
const ZERO_DECIMAL_CURRENCIES = new Set([
    "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

/**
 * Each on-sale period of `plan`, formatted in `currency` when Stripe has that
 * price configured for it (Adaptive Pricing / manual currency_options in the
 * Dashboard) — the price's own currency otherwise, so every plan always shows
 * a price. Formatted with `locale` so it renders like the rest of the page.
 */
export async function stripeDisplayPrices(
    plan: Plan,
    currency: string | undefined,
    locale: string,
): Promise<Partial<Record<Period, string>>> {
    const result: Partial<Record<Period, string>> = {};
    for (const period of PERIODS) {
        const priceId = STRIPE_PRICE_IDS[plan][period];
        if (!priceId) continue;

        const price = await getStripe().prices.retrieve(priceId, { expand: ["currency_options"] });
        const useCurrency = currency && price.currency_options?.[currency] ? currency : price.currency;
        const unitAmount =
            useCurrency === price.currency ? price.unit_amount : price.currency_options?.[useCurrency]?.unit_amount;
        if (unitAmount == null) continue;

        const amount = ZERO_DECIMAL_CURRENCIES.has(useCurrency) ? unitAmount : unitAmount / 100;
        result[period] = new Intl.NumberFormat(locale, { style: "currency", currency: useCurrency }).format(amount);
    }
    return result;
}

export function assertOnSale(plan: Plan): void {
    if (!PLANS_ON_SALE.includes(plan)) throw new ForbiddenError(`${plan} is not on sale`);
}

export const getSubscriptions = (userId: string) => repository.fetchByUser(userId);

const getSubscription = async (userId: string, plan: Plan) =>
    (await repository.fetchByUser(userId)).find((row) => row.plan === plan);

/** Refuse to sell a plan to someone who already holds it, from either store. */
export async function assertNotSubscribed(userId: string, plan: Plan): Promise<void> {
    if (isSubscriptionActive(await getSubscription(userId, plan))) throw new ConflictError("Already subscribed");
}

/** Wind down everything before the account row goes (see account-deletion-service). */
export async function cancelAllForDeletion(userId: string): Promise<void> {
    for (const row of await repository.fetchByUser(userId)) {
        if (!isSubscriptionActive(row)) continue;
        if (row.provider === "STRIPE") {
            // Immediately, not at period end: the account is gone, so there is
            // nothing left to keep active — and once the row is deleted we can
            // no longer map the subscription back to anyone.
            await getStripe().subscriptions.cancel(row.providerId);
        } else {
            // Only the user can cancel an App Store subscription, from their
            // Apple ID settings; logged so support can point them there.
            logger.info("[Subscription] Deleted account still had an App Store subscription", {
                userId,
                plan: row.plan,
                originalTransactionId: row.providerId,
            });
        }
    }
}

/* Stripe */

/** checkout.session.completed — a plan was just paid for. */
export async function activateStripe(userId: string, plan: Plan, subscription: Stripe.Subscription) {
    const current = await getSubscription(userId, plan);
    if (current?.provider === "APPLE" && isSubscriptionActive(current)) {
        // Only reachable by racing a checkout against an App Store purchase.
        // Apple's next notification takes the plan back and stops this Stripe
        // subscription (see grantApple); logged so it is not a mystery.
        logger.warn("[Subscription] Stripe checkout completed over a live Apple subscription", {
            userId,
            plan,
            stripeSubscriptionId: subscription.id,
        });
    }
    const periodEnd = stripePeriodEnd(subscription);
    if (!periodEnd) return;
    await repository.upsert(userId, plan, {
        provider: "STRIPE",
        providerId: subscription.id,
        expiresAt: periodEnd,
        cancelled: false,
    });
}

/** customer.subscription.updated — renewal, cancellation toggle, or payment trouble. */
export async function syncStripe(subscription: Stripe.Subscription) {
    // No row means it is not ours, or the plan has since moved to Apple.
    const row = await repository.fetchByProviderId("STRIPE", subscription.id);
    if (!row) return;

    // Stripe advances the period on a renewal attempt before the charge
    // succeeds, so the period end alone would extend the plan through a
    // failed payment. `past_due` keeps access while Stripe retries (the same
    // grace Apple grants); the terminal states end it.
    if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(subscription.status)) {
        await endStripe(subscription.id);
        return;
    }

    const periodEnd = stripePeriodEnd(subscription);
    if (!periodEnd) return;
    await repository.update(row.userId, row.plan, {
        expiresAt: periodEnd,
        cancelled: subscription.cancel_at_period_end,
    });
}

/** customer.subscription.deleted — the subscription is gone for good. */
export async function endStripe(subscriptionId: string) {
    const row = await repository.fetchByProviderId("STRIPE", subscriptionId);
    if (row) await repository.update(row.userId, row.plan, { expiresAt: endedNow(row.expiresAt), cancelled: false });
}

/** Cancel at period end, or undo that cancellation, on the user's live Stripe subscription for `plan`. */
export async function setStripeAutoRenew(userId: string, plan: Plan, renew: boolean) {
    const row = await getSubscription(userId, plan);
    if (!row || row.provider !== "STRIPE" || !isSubscriptionActive(row)) {
        throw new ConflictError("No Stripe subscription to update");
    }
    await getStripe().subscriptions.update(row.providerId, { cancel_at_period_end: !renew });
    await repository.update(userId, plan, { cancelled: !renew });
}

function stripePeriodEnd(subscription: Stripe.Subscription): Date | null {
    const periodEnd = subscription.items.data[0]?.current_period_end;
    if (!periodEnd) {
        logger.warn("[Subscription] Stripe subscription without a period end", { stripeSubscriptionId: subscription.id });
        return null;
    }
    return new Date(periodEnd * 1000);
}

/* Apple */

export type AppleLinkResult = { ok: true } | { ok: false; ownerEmail: string };

/**
 * Attach the App Store subscription behind `tx` to the user's account and
 * grant its plan. Called after an in-app purchase or a Restore Purchases.
 *
 * One App Store subscription backs at most one account, and a live one stays
 * with the account that bought it: cloud projects belong to that account, so
 * moving the plan elsewhere would strand them. The caller is told which
 * account holds it instead. Only a stale link — the other account's plan has
 * lapsed and the Apple ID bought again — is moved, since there is nothing
 * left to strand.
 */
export async function linkApple(userId: string, plan: Plan, tx: AppleTransaction): Promise<AppleLinkResult> {
    const holder = await repository.fetchByProviderId("APPLE", tx.originalTransactionId);
    if (holder && holder.userId !== userId) {
        if (isSubscriptionActive(holder)) return { ok: false, ownerEmail: maskEmail(holder.user.email) };

        await repository.delete(holder.userId, holder.plan);
        logger.info("[Subscription] Lapsed Apple subscription re-linked to another account", {
            originalTransactionId: tx.originalTransactionId,
            plan,
            from: holder.userId,
            to: userId,
        });
    }

    await grantApple({ userId, plan }, tx);
    return { ok: true };
}

/**
 * Who an Apple event belongs to: the account holding its original transaction
 * id, else the one whose id was passed as app account token at purchase time —
 * which covers a notification arriving before the app's own link request did.
 */
export async function getAppleSubscriber(tx: AppleTransaction): Promise<Subscriber | null> {
    const row = await repository.fetchByProviderId("APPLE", tx.originalTransactionId);
    if (row) return { userId: row.userId, plan: row.plan };

    const plan = planForAppleProduct(tx.bundleId, tx.productId);
    if (!plan || !tx.appAccountToken) return null;
    // Apple serialises the token as an upper-case UUID; our ids are lower-case.
    const user = await UserService.getUserFromId(tx.appAccountToken.toLowerCase());
    return user ? { userId: user.id, plan } : null;
}

/**
 * Grant a plan from an App Store transaction and make Apple the store that
 * bills it. A live Stripe subscription for the same plan is set to stop at
 * period end (see the module comment) — the plan carries on uninterrupted.
 */
export async function grantApple({ userId, plan }: Subscriber, tx: AppleTransaction, autoRenewOff = false) {
    const current = await getSubscription(userId, plan);
    if (current?.provider === "STRIPE" && isSubscriptionActive(current) && !current.cancelled) {
        logger.warn("[Subscription] Apple subscription over a live Stripe one; Stripe stops at period end", {
            userId,
            plan,
            stripeSubscriptionId: current.providerId,
        });
        try {
            await getStripe().subscriptions.update(current.providerId, { cancel_at_period_end: true });
        } catch (e) {
            logger.error("[Subscription] Failed to stop the Stripe subscription", { userId, plan, error: e });
        }
    }

    await repository.upsert(userId, plan, {
        provider: "APPLE",
        providerId: tx.originalTransactionId,
        expiresAt: new Date(tx.expiresDate ?? Date.now()),
        cancelled: autoRenewOff,
    });
}

/** DID_CHANGE_RENEWAL_STATUS — the user toggled auto-renew in their App Store settings. */
export async function setAppleAutoRenew(tx: AppleTransaction, renew: boolean) {
    const row = await repository.fetchByProviderId("APPLE", tx.originalTransactionId);
    if (row) await repository.update(row.userId, row.plan, { cancelled: !renew });
}

/** DID_FAIL_TO_RENEW with a billing grace period — keep access while Apple retries. */
export async function extendApple(tx: AppleTransaction, until: Date) {
    const row = await repository.fetchByProviderId("APPLE", tx.originalTransactionId);
    if (row) await repository.update(row.userId, row.plan, { expiresAt: until });
}

/** EXPIRED / REVOKE / REFUND — the row stays: a resubscribe from the App Store reuses its id. */
export async function endApple(tx: AppleTransaction) {
    const row = await repository.fetchByProviderId("APPLE", tx.originalTransactionId);
    if (row) await repository.update(row.userId, row.plan, { expiresAt: endedNow(row.expiresAt), cancelled: false });
}

/** An ended subscription keeps its natural expiry when that has passed, and is cut to now otherwise. */
const endedNow = (expiresAt: Date) => new Date(Math.min(expiresAt.getTime(), Date.now()));

/** `h***@example.com` — enough for the user to recognise their own other account, no more. */
function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    return `${local[0] ?? ""}***@${domain ?? ""}`;
}
