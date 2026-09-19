"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, BadgePercent, Check, ExternalLink, Lock, Sparkles } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import {
    cancelStripeSubscription,
    createStripeCheckout,
    getStripePrices,
    linkApplePurchase,
    resumeStripeSubscription,
} from "@src/lib/utils/requests";
import {
    APPLE_SUBSCRIPTIONS_URL,
    getApplePrices,
    isAppleStoreBuild,
    purchaseApplePlan,
    restoreApplePlans,
} from "@src/lib/apple-iap";
import { getSubscription, isSubscriptionActive, Period, PERIODS, Plan, PLANS, PLANS_ON_SALE } from "@src/lib/plans";
import { useUser } from "@src/lib/utils/hooks";
import { useLocale } from "@src/context/LocaleContext";

import styles from "./SubscriptionSettings.module.css";

const PLAN_PERKS: Record<Plan, readonly string[]> = {
    CLOUD: ["cloudSync", "collaboration", "sharedStorage"],
};

// Apple's standard EULA covers App Store purchases until we publish our own
// terms; both links are required next to an auto-renewable subscription.
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = `${process.env.NEXT_PUBLIC_API_URL || "https://scenarly.com"}/privacy`;

type Action = "upgrade" | "cancel" | "resume";
type LinkStatus = "linked" | "owned" | "error";

const openExternal = async (url: string) => {
    if (isTauri()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
    } else {
        window.open(url, "_blank");
    }
};

/**
 * One card per plan. Each is billed by Stripe (web, Windows) or by Apple (App
 * Store builds), and a card only ever offers the store the current build sells
 * through — an App Store build must not point at any other way to pay.
 * Whichever store bills a plan is where it gets managed: Stripe in place,
 * Apple through the user's App Store settings. Restore Purchases is shared:
 * one call brings back every plan the Apple ID holds.
 */
const SubscriptionSettings = () => {
    const { user, mutate } = useUser();
    const t = useTranslations("profile.subscription");
    const { locale } = useLocale();

    // `${plan}:${action}`, or "restore" — one thing at a time across the cards.
    const [busy, setBusy] = useState<string | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<Plan | null>(null);
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
    // Detect the App Store build after mount so SSR renders the same tree the
    // client initially does, avoiding hydration mismatches; done inline with
    // the price fetch below so the right store is asked on the first try.
    const [isAppleBuild, setIsAppleBuild] = useState(false);

    // A plan shows up once it is on sale, or as long as the user still holds it.
    const visiblePlans = PLANS.filter((plan) => PLANS_ON_SALE.includes(plan) || getSubscription(user, plan));
    const planName = (plan: Plan) => t(`plans.${plan}.name` as Parameters<typeof t>[0]);
    const formatDate = (date: string | Date) =>
        new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(date));

    useEffect(() => {
        const appleBuild = isAppleStoreBuild();
        setIsAppleBuild(appleBuild);
        for (const plan of PLANS_ON_SALE) {
            const planPrices = appleBuild ? getApplePrices(plan) : getStripePrices(plan, locale);
            planPrices.then((prices) => setPrices((p) => ({ ...p, [plan]: prices }))).catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- platform + prices, fetched once on mount
    }, []);

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
        const result = await createStripeCheckout(plan, periodOf(plan));
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

    /* Apple */

    /**
     * Hand a signed transaction to the server; "linked" once the account holds
     * the plan. A subscription bought under another Scenarly account stays
     * there — its cloud projects live in that account — so the user is told
     * which one to sign in with.
     */
    const linkApple = async (plan: Plan, jws: string): Promise<LinkStatus> => {
        const result = await linkApplePurchase(jws);
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

    const handleApplePurchase = (plan: Plan) => run(`${plan}:upgrade`, async () => {
        if (!user?.id) return;
        try {
            const jws = await purchaseApplePlan(plan, periodOf(plan), user.id);
            // Sheet dismissed, or the purchase is pending approval (Ask to Buy).
            if (jws) await linkApple(plan, jws);
        } catch (err) {
            // StoreKit refuses to sell a subscription the Apple ID already
            // holds; when that is what happened, the existing one is what to link.
            const existing = (await restoreApplePlans().catch((): Partial<Record<Plan, string>> => ({})))[plan];
            if (existing) {
                await linkApple(plan, existing);
            } else {
                console.error("[SubscriptionSettings] Apple purchase failed:", err);
                setError(t("purchaseError"));
            }
        }
    });

    const handleRestore = () => run("restore", async () => {
        try {
            const found = Object.entries(await restoreApplePlans()) as [Plan, string][];
            if (!found.length) {
                setNotice(t("restoreNone"));
                return;
            }
            let restored = 0;
            for (const [plan, jws] of found) {
                if ((await linkApple(plan, jws)) === "linked") restored++;
            }
            if (restored) setNotice(t("restoreDone"));
        } catch (err) {
            // Typically no Apple ID signed in on the device.
            console.error("[SubscriptionSettings] Restore failed:", err);
            setError(t("restoreError"));
        }
    });

    const isBusy = (plan: Plan, action: Action) => busy === `${plan}:${action}`;

    const renderActions = (plan: Plan) => {
        const subscription = getSubscription(user, plan);
        const active = isSubscriptionActive(subscription);
        const name = planName(plan);
        const expiry = subscription ? formatDate(subscription.expiresAt) : "";

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

        if (active && isAppleBuild) {
            // Billed by Stripe, seen from the App Store build: say so, offer nothing.
            return <p className={styles.infoText}>{t("webBilledInfo")}</p>;
        }

        if (active) {
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
            if (subscription?.cancelled) {
                return (
                    <button className={styles.upgradeBtn} onClick={() => handleResume(plan)} disabled={busy !== null}>
                        <span className={styles.upgradeBtnLabel}>{t("resubscribe")}</span>
                        <ArrowRight size={16} />
                    </button>
                );
            }
            return (
                <button className={styles.cancelBtn} onClick={() => setCancelConfirm(plan)}>
                    {t("cancel")}
                </button>
            );
        }

        // A lapsed plan that is no longer sold: nothing to offer.
        if (!PLANS_ON_SALE.includes(plan)) return null;

        const period = periodOf(plan);
        const price = prices[plan]?.[period];
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

        if (isAppleBuild) {
            return (
                <>
                    <div className={styles.purchaseRow}>
                        {periodToggle}
                        <button className={styles.upgradeBtn} onClick={() => handleApplePurchase(plan)} disabled={busy !== null}>
                            <span className={styles.upgradeBtnLabel}>
                                {isBusy(plan, "upgrade")
                                    ? t("purchasing")
                                    : price
                                        ? t("upgradeBtnPrice", { price, period: t(period === "MONTHLY" ? "perMonth" : "perYear") })
                                        : t("upgradeBtn")}
                            </span>
                            {!isBusy(plan, "upgrade") && <ArrowRight size={16} />}
                        </button>
                    </div>
                    <p className={styles.legalText}>
                        {t("appleTerms")}{" "}
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
                <button className={styles.upgradeBtn} onClick={() => handleCheckout(plan)} disabled={busy !== null}>
                    <span className={styles.upgradeBtnLabel}>
                        {isBusy(plan, "upgrade")
                            ? t("redirecting")
                            : price
                                ? t("upgradeBtnPrice", { price, period: t(period === "MONTHLY" ? "perMonth" : "perYear") })
                                : t("upgradeBtn")}
                    </span>
                    {!isBusy(plan, "upgrade") && <ArrowRight size={16} />}
                </button>
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

            {isAppleBuild && (
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
