/**
 * The paid plans, as both the browser and the server see them.
 *
 * Each plan is an independent monthly subscription; a user can hold any
 * combination, billed monthly or yearly — the period is a price of a plan,
 * not a plan. Adding a plan means: a value in the Prisma `Plan` enum, its
 * Stripe prices (subscription-service) and App Store products (below), its
 * perks and wording (SubscriptionSettings + messages), then listing it in
 * `PLANS_ON_SALE` once it can be bought. Kept free of server imports so
 * components can use it.
 */

import type { Plan, SubscriptionProvider } from "@src/generated/client/browser";

export type { Plan };

export const PLANS = ["CLOUD"] as const satisfies readonly Plan[];

export const PERIODS = ["MONTHLY", "YEARLY"] as const;
export type Period = (typeof PERIODS)[number];

/** How each plan is called in the interface. */
export const PLAN_NAMES: Record<Plan, string> = { CLOUD: "Cloud" };

/**
 * Plans that can currently be bought. A plan not on sale is neither offered
 * in the app nor accepted by the checkout routes, but a subscription someone
 * already holds is still honoured and shown.
 */
export const PLANS_ON_SALE: readonly Plan[] = ["CLOUD"];

/**
 * App Store product id of a plan's period: `com.scenarly.cloud.month`.
 * Prefixed with the bundle id because Apple requires product ids to be unique
 * across the whole developer team, so the staging app carries its own set
 * (`com.scenarly.staging.cloud.month`). One subscription group per plan.
 * Uses `month`/`year` rather than `monthly`/`yearly` because the latter got
 * created once as a plain (non-subscription) IAP and deleted — Apple never
 * allows a product id to be reused after that, even across product types —
 * so this spelling must stay as-is rather than reverting to the "ly" form.
 */
const APPLE_PERIOD_SEGMENT: Record<Period, string> = { MONTHLY: "month", YEARLY: "year" };

export const appleProductId = (bundleId: string, plan: Plan, period: Period) =>
    `${bundleId}.${plan.toLowerCase()}.${APPLE_PERIOD_SEGMENT[period]}`;

export const planForAppleProduct = (bundleId: string, productId: string): Plan | null =>
    PLANS.find((plan) => PERIODS.some((period) => appleProductId(bundleId, plan, period) === productId)) ?? null;

/** A subscription row as `/api/users` hands it to the browser. */
export type UserSubscription = {
    plan: Plan;
    provider: SubscriptionProvider;
    expiresAt: string | Date;
    cancelled: boolean;
};

export const getSubscription = (
    user: { subscriptions?: UserSubscription[] } | null | undefined,
    plan: Plan,
): UserSubscription | undefined => user?.subscriptions?.find((s) => s.plan === plan);

export const isSubscriptionActive = (subscription: { expiresAt: string | Date } | null | undefined): boolean =>
    !!subscription && new Date(subscription.expiresAt) > new Date();

export const hasActivePlan = (user: { subscriptions?: UserSubscription[] } | null | undefined, plan: Plan): boolean =>
    isSubscriptionActive(getSubscription(user, plan));
