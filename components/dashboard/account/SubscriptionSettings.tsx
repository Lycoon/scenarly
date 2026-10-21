"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, BadgePercent, Check, ExternalLink, Lock, Sparkles } from "lucide-react";
import {
    cancelStripeSubscription,
    createStripeCheckout,
    getStripePrices,
    getStripeWithdrawal,
    linkApplePurchase,
    linkGooglePurchase,
    resumeStripeSubscription,
    StripeWithdrawal,
    withdrawStripeSubscription,
} from "@src/lib/utils/requests";
import {
    APPLE_SUBSCRIPTIONS_URL,
    getApplePrices,
    isAppleStoreBuild,
    purchaseApplePlan,
    restoreApplePlans,
} from "@src/lib/apple-iap";
import {
    getGooglePrices,
    GOOGLE_SUBSCRIPTIONS_URL,
    isPlayStoreBuild,
    purchaseGooglePlan,
    restoreGooglePlans,
} from "@src/lib/google-iap";
import { getSubscription, isSubscriptionActive, Period, PERIODS, Plan, PLANS, PLANS_ON_SALE } from "@src/lib/plans";
import { useUser } from "@src/lib/utils/hooks";
import { useLocale } from "@src/context/LocaleContext";
import { openExternal } from "@src/lib/utils/open-external";

import styles from "./SubscriptionSettings.module.css";

const PLAN_PERKS: Record<Plan, readonly string[]> = {
    CLOUD: ["cloudSync", "collaboration", "sharedStorage"],
};

// Both links are required next to an auto-renewable subscription. The Terms
// carry the terms Apple requires of a custom licence agreement (section 12);
// App Store Connect must point at the same page.
const TERMS_URL = `${process.env.NEXT_PUBLIC_API_URL || "https://scenarly.com"}/terms`;
const PRIVACY_URL = `${process.env.NEXT_PUBLIC_API_URL || "https://scenarly.com"}/privacy`;

type Action = "upgrade" | "cancel" | "resume" | "withdraw";
type LinkStatus = "linked" | "owned" | "error";

/**
 * One card per plan. Each is billed by Stripe (web, Windows, Linux), by Apple
 * (App Store builds) or by Google (the Google Play build), and a card only
 * ever offers the store the current build sells through — an app store build
 * must not point at any other way to pay.
 * Whichever store bills a plan is where it gets managed: Stripe in place,
 * Apple and Google through the user's store subscriptions. Restore Purchases
 * is shared: one call brings back every plan the store account holds.
 *
 * During the 14 days after a Stripe purchase, the card also offers the legal
 * right of withdrawal next to Cancel: withdrawing ends the plan now and
 * refunds the unused days, cancelling keeps it to the end of the period.
 * Apple runs withdrawals for App Store purchases itself.
 */
const SubscriptionSettings = () => {
    const { user, mutate } = useUser();
    const t = useTranslations("profile.subscription");
    const { locale } = useLocale();

    // `${plan}:${action}`, or "restore" — one thing at a time across the cards.
    const [busy, setBusy] = useState<string | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<Plan | null>(null);
    const [withdrawConfirm, setWithdrawConfirm] = useState<Plan | null>(null);
    // Set only for Stripe plans still inside their withdrawal period.
    const [withdrawals, setWithdrawals] = useState<Partial<Record<Plan, StripeWithdrawal>>>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [periods, setPeriods] = useState<Partial<Record<Plan, Period>>>({});
    const [prices, setPrices] = useState<Partial<Record<Plan, Partial<Record<Period, string>>>>>({});
    const [welcome, setWelcome] = useState<Plan | null>(() => {
        if (typeof window === "undefined") return null;
        const plan = sessionStorage.getItem("welcomePlan");
        return PLANS.includes(plan as Plan) ? (plan as Plan) : null;
    });
    const [welcomeLeaving, setWelcomeLeaving] = useState(false);
    // Detect the app store builds after mount so SSR renders the same tree the
    // client initially does, avoiding hydration mismatches; done inline with
    // the price fetch below so the right store is asked on the first try.
    const [isAppleBuild, setIsAppleBuild] = useState(false);
    const [isPlayBuild, setIsPlayBuild] = useState(false);
    const isAppStoreBuild = isAppleBuild || isPlayBuild;

    // A plan shows up once it is on sale, or as long as the user still holds it.
    const visiblePlans = PLANS.filter((plan) => PLANS_ON_SALE.includes(plan) || getSubscription(user, plan));
    const planName = (plan: Plan) => t(`plans.${plan}.name` as Parameters<typeof t>[0]);
    const formatDate = (date: string | Date) =>
        new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(date));

    useEffect(() => {
        const appleBuild = isAppleStoreBuild();
        setIsAppleBuild(appleBuild);
        const playBuild = isPlayStoreBuild();
        setIsPlayBuild(playBuild);
        for (const plan of PLANS_ON_SALE) {
            const planPrices = appleBuild
                ? getApplePrices(plan)
                : playBuild
                  ? getGooglePrices(plan)
                  : getStripePrices(plan, locale);
            planPrices.then((prices) => setPrices((p) => ({ ...p, [plan]: prices }))).catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- platform + prices, fetched once on mount
    }, []);

    // Plans billed by Stripe right now, as a stable key for the effect below.
    const stripePlansKey = PLANS.filter((plan) => {
        const subscription = getSubscription(user, plan);
        return subscription?.provider === "STRIPE" && isSubscriptionActive(subscription);
    }).join(",");

    useEffect(() => {
        // An App Store build shows nothing about Stripe billing but where it lives.
        if (!stripePlansKey || isAppleStoreBuild()) return;
        let stale = false;
        for (const plan of stripePlansKey.split(",") as Plan[]) {
            getStripeWithdrawal(plan, locale)
                .then((withdrawal) => {
                    if (!stale) setWithdrawals((w) => ({ ...w, [plan]: withdrawal ?? undefined }));
                })
                .catch(() => {});
        }
        return () => {
            stale = true;
        };
    }, [stripePlansKey, locale]);

    useEffect(() => {
        if (!welcome) return;
        sessionStorage.removeItem("welcomePlan");
        setWelcomeLeaving(false);
        const fadeTimer = setTimeout(() => setWelcomeLeaving(true), 4000);
        const hideTimer = setTimeout(() => setWelcome(null), 4600);
        return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
    }, [welcome]);

    const run = async (key: string, task: () => Promise<void>) => {
        setError(null);
        setNotice(null);
        setBusy(key);
        try {
            await task();
        } finally {
            setBusy(null);
        }
    };

    /* Stripe */

    const periodOf = (plan: Plan): Period => periods[plan] ?? "MONTHLY";

    const handleCheckout = (plan: Plan) => run(`${plan}:upgrade`, async () => {
        const result = await createStripeCheckout(plan, periodOf(plan), locale);
        if (result.url) {
            window.location.href = result.url;
            // Stay busy while the browser navigates away.
            await new Promise(() => {});
        }
        if (result.status === 409) {
            // The account already holds this plan — this view was stale.
            await mutate();
            setNotice(t("alreadySubscribed"));
        } else {
            setError(t("purchaseError"));
        }
    });

    const handleCancel = (plan: Plan) => run(`${plan}:cancel`, async () => {
        if (await cancelStripeSubscription(plan)) await mutate();
        else setError(t("purchaseError"));
        setCancelConfirm(null);
    });

    const handleResume = (plan: Plan) => run(`${plan}:resume`, async () => {
        if (await resumeStripeSubscription(plan)) await mutate();
        else setError(t("purchaseError"));
    });

    const handleWithdraw = (plan: Plan) => run(`${plan}:withdraw`, async () => {
        const refund = await withdrawStripeSubscription(plan, locale);
        setWithdrawConfirm(null);
        if (refund === null) {
            setError(t("withdrawError"));
            return;
        }
        setWithdrawals((w) => ({ ...w, [plan]: undefined }));
        await mutate();
        setNotice(t("withdrawDone", { refund, email: user?.email ?? "" }));
    });

    /* App stores (Apple, Google) */

    // The proof of purchase each store hands the app: a signed transaction
    // from Apple, a purchase token from Google.
    const store = isAppleBuild
        ? { purchase: purchaseApplePlan, restore: restoreApplePlans, link: linkApplePurchase }
        : { purchase: purchaseGooglePlan, restore: restoreGooglePlans, link: linkGooglePurchase };

    /**
     * Hand a proof of purchase to the server; "linked" once the account holds
     * the plan. A subscription bought under another Scenarly account stays
     * there — its cloud projects live in that account — so the user is told
     * which one to sign in with.
     */
    const linkStore = async (plan: Plan, proof: string): Promise<LinkStatus> => {
        const result = await store.link(proof);
        if (result.status === "linked") {
            await mutate();
            setWelcome(plan);
        } else if (result.status === "owned") {
            setError(t("linkedToOther", { email: result.ownerEmail }));
        } else {
            setError(t("purchaseError"));
        }
        return result.status;
    };

    const handleStorePurchase = (plan: Plan) => run(`${plan}:upgrade`, async () => {
        if (!user?.id) return;
        try {
            const proof = await store.purchase(plan, periodOf(plan), user.id);
            // Sheet dismissed, or the payment is pending (Ask to Buy, cash).
            if (proof) await linkStore(plan, proof);
        } catch (err) {
            // Both stores refuse to sell a subscription the store account
            // already holds; when that is what happened, the existing one is
            // what to link.
            const existing = (await store.restore().catch((): Partial<Record<Plan, string>> => ({})))[plan];
            if (existing) {
                await linkStore(plan, existing);
            } else {
                console.error("[SubscriptionSettings] Store purchase failed:", err);
                setError(t("purchaseError"));
            }
        }
    });

    const handleRestore = () => run("restore", async () => {
        try {
            const found = Object.entries(await store.restore()) as [Plan, string][];
            if (!found.length) {
                setNotice(t(isAppleBuild ? "restoreNone" : "googleRestoreNone"));
                return;
            }
            let restored = 0;
            for (const [plan, proof] of found) {
                if ((await linkStore(plan, proof)) === "linked") restored++;
            }
            if (restored) setNotice(t("restoreDone"));
        } catch (err) {
            // Typically no store account signed in on the device.
            console.error("[SubscriptionSettings] Restore failed:", err);
            setError(t(isAppleBuild ? "restoreError" : "googleRestoreError"));
        }
    });

    const isBusy = (plan: Plan, action: Action) => busy === `${plan}:${action}`;

    const renderActions = (plan: Plan) => {
        const subscription = getSubscription(user, plan);
        const active = isSubscriptionActive(subscription);
        const name = planName(plan);
        const expiry = subscription ? formatDate(subscription.expiresAt) : "";

        if (active && subscription?.provider === "GRANT") {
            // Given by us: nothing to cancel, resume or withdraw from.
            return <p className={styles.infoText}>{t("grantedInfo")}</p>;
        }

        if (active && subscription?.provider === "APPLE") {
            // Cancelling or resuming an App Store subscription is Apple's UI.
            return (
                <>
                    <p className={styles.infoText}>{t("appleBilledInfo")}</p>
                    <button className={styles.secondaryBtn} onClick={() => openExternal(APPLE_SUBSCRIPTIONS_URL)}>
                        {t("manageApple")}
                        <ExternalLink size={16} />
                    </button>
                </>
            );
        }

        if (active && subscription?.provider === "GOOGLE") {
            // Cancelling or resuming a Play subscription is Google's UI.
            return (
                <>
                    <p className={styles.infoText}>{t("googleBilledInfo")}</p>
                    <button className={styles.secondaryBtn} onClick={() => openExternal(GOOGLE_SUBSCRIPTIONS_URL)}>
                        {t("manageGoogle")}
                        <ExternalLink size={16} />
                    </button>
                </>
            );
        }

        if (active && isAppleBuild) {
            // Billed by Stripe, seen from the App Store build: say so, offer nothing.
            return <p className={styles.infoText}>{t("webBilledInfo")}</p>;
        }

        if (active) {
            const withdrawal = withdrawals[plan];
            if (withdrawal && withdrawConfirm === plan) {
                return (
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>
                            {t("withdrawConfirm", { plan: name, refund: withdrawal.refund, email: user?.email ?? "" })}
                        </p>
                        <div className={styles.confirmBtns}>
                            <button className={styles.confirmYes} onClick={() => handleWithdraw(plan)} disabled={busy !== null}>
                                {isBusy(plan, "withdraw") ? t("withdrawing") : t("withdrawYes")}
                            </button>
                            <button className={styles.confirmNo} onClick={() => setWithdrawConfirm(null)} disabled={busy !== null}>
                                {t("cancelNo", { plan: name })}
                            </button>
                        </div>
                    </div>
                );
            }
            if (cancelConfirm === plan) {
                return (
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>{t("cancelConfirm", { plan: name, date: expiry })}</p>
                        <div className={styles.confirmBtns}>
                            <button className={styles.confirmYes} onClick={() => handleCancel(plan)} disabled={busy !== null}>
                                {isBusy(plan, "cancel") ? t("cancelling") : t("cancelYes")}
                            </button>
                            <button className={styles.confirmNo} onClick={() => setCancelConfirm(null)} disabled={busy !== null}>
                                {t("cancelNo", { plan: name })}
                            </button>
                        </div>
                    </div>
                );
            }
            const withdrawButton = withdrawal && (
                <button className={styles.cancelBtn} onClick={() => setWithdrawConfirm(plan)} disabled={busy !== null}>
                    {t("withdraw")}
                </button>
            );
            // The last day of the period, as the server counts it (UTC).
            const withdrawHint = withdrawal && (
                <p className={styles.legalText}>
                    {t("withdrawHint", {
                        plan: name,
                        refund: withdrawal.refund,
                        date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
                            new Date(Date.parse(withdrawal.until) - 1),
                        ),
                    })}
                </p>
            );
            if (subscription?.cancelled) {
                return (
                    <>
                        {isPlayBuild ? (
                            // Reactivating bills again, which Play only allows through its own billing.
                            <p className={styles.infoText}>{t("webBilledInfo")}</p>
                        ) : (
                            <button className={styles.upgradeBtn} onClick={() => handleResume(plan)} disabled={busy !== null}>
                                <span className={styles.upgradeBtnLabel}>{t("resubscribe")}</span>
                                <ArrowRight size={16} />
                            </button>
                        )}
                        {withdrawButton}
                        {withdrawHint}
                    </>
                );
            }
            return (
                <>
                    <div className={styles.actionRow}>
                        <button className={styles.cancelBtn} onClick={() => setCancelConfirm(plan)}>
                            {t("cancel")}
                        </button>
                        {withdrawButton}
                    </div>
                    {withdrawHint}
                </>
            );
        }

        // A lapsed plan that is no longer sold: nothing to offer.
        if (!PLANS_ON_SALE.includes(plan)) return null;

        const period = periodOf(plan);
        const purchasing = isBusy(plan, "upgrade");
        const labelFor = (option: Period) => {
            const price = prices[plan]?.[option];
            return price
                ? t("upgradeBtnPrice", { price, period: t(option === "MONTHLY" ? "perMonth" : "perYear") })
                : t("upgradeBtn");
        };
        // Every label the button can show is rendered, stacked in one grid cell
        // with only the current one visible, so the button keeps the size of
        // its widest label: switching period or starting a purchase never
        // resizes it. The arrow likewise stays in place, just hidden, while busy.
        const purchaseButton = (onClick: () => void, busyLabel: string) => (
            <button className={styles.upgradeBtn} onClick={onClick} disabled={busy !== null}>
                <span className={styles.upgradeBtnLabels}>
                    {PERIODS.map((option) => (
                        <span
                            key={option}
                            className={`${styles.upgradeBtnLabel} ${purchasing || option !== period ? styles.upgradeBtnLabelHidden : ""}`}
                        >
                            {labelFor(option)}
                        </span>
                    ))}
                    <span className={`${styles.upgradeBtnLabel} ${purchasing ? "" : styles.upgradeBtnLabelHidden}`}>
                        {busyLabel}
                    </span>
                </span>
                <ArrowRight size={16} className={`${styles.upgradeBtnArrow} ${purchasing ? styles.upgradeBtnLabelHidden : ""}`} />
            </button>
        );
        const periodToggle = (
            <div className={styles.periodToggleWrap}>
                <div className={styles.periodToggle} role="radiogroup">
                    {PERIODS.map((option) => (
                        <button
                            key={option}
                            role="radio"
                            aria-checked={option === period}
                            className={`${styles.periodOption} ${option === period ? styles.periodOptionActive : ""}`}
                            onClick={() => setPeriods((p) => ({ ...p, [plan]: option }))}
                            disabled={busy !== null}
                        >
                            {option === "YEARLY" && <BadgePercent size={16} className={styles.periodOptionIcon} />}
                            {t(option === "MONTHLY" ? "monthly" : "yearly")}
                        </button>
                    ))}
                </div>
                {period === "YEARLY" && <span className={styles.periodHint}>{t("yearlyHint")}</span>}
            </div>
        );

        if (isAppStoreBuild) {
            return (
                <>
                    <div className={styles.purchaseRow}>
                        {periodToggle}
                        {purchaseButton(() => handleStorePurchase(plan), t("purchasing"))}
                    </div>
                    <p className={styles.legalText}>
                        {t(isAppleBuild ? "appleTerms" : "googleTerms")}{" "}
                        <a onClick={() => openExternal(TERMS_URL)}>{t("termsLink")}</a>
                        {" · "}
                        <a onClick={() => openExternal(PRIVACY_URL)}>{t("privacyLink")}</a>
                    </p>
                </>
            );
        }

        return (
            <div className={styles.purchaseRow}>
                {periodToggle}
                {purchaseButton(() => handleCheckout(plan), t("redirecting"))}
            </div>
        );
    };

    const renderCard = (plan: Plan) => {
        const subscription = getSubscription(user, plan);
        const active = isSubscriptionActive(subscription);
        return (
            <div key={plan} className={styles.card} data-active={String(active)}>
                <div className={styles.header}>
                    <span className={styles.planName}>{t(`plans.${plan}.title` as Parameters<typeof t>[0])}</span>
                    {active && <span className={styles.activeBadge}>{t("activeBadge")}</span>}
                </div>

                {active && subscription && (
                    <p className={styles.renewDate}>
                        {subscription.cancelled
                            ? t("endsOn", { date: formatDate(subscription.expiresAt) })
                            : t("renewsOn", { date: formatDate(subscription.expiresAt) })}
                    </p>
                )}

                <div className={styles.perksSection}>
                    <p className={styles.perksTitle}>{active ? t("perksTitle") : t("upgradeTitle")}</p>
                    {PLAN_PERKS[plan].map((perk) => (
                        <div key={perk} className={styles.perkItem}>
                            {active
                                ? <Check size={14} className={styles.perkIconActive} />
                                : <Lock size={14} className={styles.perkIconFree} />
                            }
                            {t(`plans.${plan}.perks.${perk}` as Parameters<typeof t>[0])}
                        </div>
                    ))}
                </div>

                {renderActions(plan)}

                {welcome === plan && (
                    <div className={`${styles.welcomeBox} ${welcomeLeaving ? styles.welcomeBoxLeaving : ""}`}>
                        <Sparkles size={15} className={styles.welcomeIcon} />
                        <span>{t("welcome", { plan: planName(plan) })}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.list}>
            {visiblePlans.map(renderCard)}

            {isAppStoreBuild && (
                <button className={styles.secondaryBtn} onClick={handleRestore} disabled={busy !== null}>
                    {busy === "restore" ? t("restoring") : t("restorePurchases")}
                </button>
            )}
            {notice && <p className={styles.notice}>{notice}</p>}
            {error && <p className={styles.errorMessage}>{error}</p>}
        </div>
    );
};

export default SubscriptionSettings;
