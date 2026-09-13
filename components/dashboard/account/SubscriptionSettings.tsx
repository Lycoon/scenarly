"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ExternalLink, Lock, Sparkles } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { cancelStripeSubscription, createStripeCheckout } from "@src/lib/utils/requests";
import { useUser } from "@src/lib/utils/hooks";
import { useLocale } from "@src/context/LocaleContext";

import styles from "./SubscriptionSettings.module.css";

const PERKS = ["perkProjects", "perkSaves", "perkCollaborators", "perkAutoSave"] as const;

// Where the macOS App Store build sends users to manage billing. Cloud is sold
// exclusively through the website (Stripe), so the App Store app never handles
// payments itself — this avoids Apple's in-app-purchase fee.
const WEBSITE_URL = process.env.NEXT_PUBLIC_API_URL || "https://scenarly.com";

// The macOS Tauri build ships through the App Store, so it must not sell or
// manage subscriptions in-app; it links out to the website instead. The Windows
// Tauri build and the web app bill through Stripe directly.
const isMacosTauri = () =>
    isTauri() && typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

const SubscriptionSettings = () => {
    const { user, mutate } = useUser();
    const t = useTranslations("profile");
    const { locale } = useLocale();

    const [upgradeLoading, setUpgradeLoading] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showWelcome, setShowWelcome] = useState(
        () => typeof window !== "undefined" && sessionStorage.getItem("cloudWelcome") === "1"
    );
    const [welcomeLeaving, setWelcomeLeaving] = useState(false);
    // Detect the macOS App Store build after mount so SSR renders the same tree
    // the client initially does, avoiding hydration mismatches.
    const [isAppleStoreBuild, setIsAppleStoreBuild] = useState(false);
    useEffect(() => { setIsAppleStoreBuild(isMacosTauri()); }, []);

    const hasCloudPlan = !!user?.cloudPlanUntil && new Date(user.cloudPlanUntil) > new Date();
    const isCancelled = !!user?.isSubscriptionCancelled;
    const expiryDate = user?.cloudPlanUntil
        ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(user.cloudPlanUntil))
        : "";

    useEffect(() => {
        if (!showWelcome) return;
        sessionStorage.removeItem("cloudWelcome");
        const fadeTimer = setTimeout(() => setWelcomeLeaving(true), 4000);
        const hideTimer = setTimeout(() => setShowWelcome(false), 4600);
        return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const openWebsite = async () => {
        if (isTauri()) {
            const { openUrl } = await import("@tauri-apps/plugin-opener");
            await openUrl(WEBSITE_URL);
        } else {
            window.open(WEBSITE_URL, "_blank");
        }
    };

    const handleUpgrade = async () => {
        setError(null);
        setUpgradeLoading(true);

        const result = await createStripeCheckout();
        if (result?.url) {
            window.location.href = result.url;
        } else {
            setError(t("subscription.purchaseError"));
            setUpgradeLoading(false);
        }
    };

    const handleCancel = async () => {
        setCancelling(true);
        const ok = await cancelStripeSubscription();
        if (ok) await mutate();
        setCancelling(false);
        setCancelConfirm(false);
    };

    return (
        <div className={styles.card} data-cloud={String(hasCloudPlan)}>
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.planName}>
                    {hasCloudPlan ? t("subscription.cloudTitle") : t("subscription.freeTitle")}
                </span>
                {hasCloudPlan && <span className={styles.cloudBadge}>{t("subscription.cloudBadge")}</span>}
            </div>

            {/* Renewal / end date */}
            {hasCloudPlan && (
                <p className={styles.renewDate}>
                    {isCancelled
                        ? t("subscription.endsOn", { date: expiryDate })
                        : t("subscription.renewsOn", { date: expiryDate })
                    }
                </p>
            )}

            {/* Perks list */}
            <div className={styles.perksSection}>
                <p className={styles.perksTitle}>
                    {hasCloudPlan ? t("subscription.perksTitle") : t("subscription.upgradeTitle")}
                </p>
                {PERKS.map((perk) => (
                    <div key={perk} className={styles.perkItem}>
                        {hasCloudPlan
                            ? <Check size={14} className={styles.perkIconCloud} />
                            : <Lock size={14} className={styles.perkIconFree} />
                        }
                        {t(`subscription.${perk}` as Parameters<typeof t>[0])}
                    </div>
                ))}
            </div>

            {/* Actions */}
            {isAppleStoreBuild ? (
                // App Store build: never bill in-app — direct users to the website.
                <>
                    <p className={styles.infoText}>
                        {hasCloudPlan
                            ? t("subscription.appleStoreCloudInfo")
                            : t("subscription.appleStoreFreeInfo")
                        }
                    </p>
                    <button className={styles.upgradeBtn} onClick={openWebsite}>
                        {t("subscription.openWebsite")}
                        <ExternalLink size={16} />
                    </button>
                </>
            ) : hasCloudPlan ? (
                cancelConfirm ? (
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>
                            {t("subscription.cancelConfirm", { date: expiryDate })}
                        </p>
                        <div className={styles.confirmBtns}>
                            <button className={styles.confirmYes} onClick={handleCancel} disabled={cancelling}>
                                {cancelling ? t("subscription.cancelling") : t("subscription.cancelYes")}
                            </button>
                            <button className={styles.confirmNo} onClick={() => setCancelConfirm(false)} disabled={cancelling}>
                                {t("subscription.cancelNo")}
                            </button>
                        </div>
                    </div>
                ) : isCancelled ? (
                    <button className={styles.upgradeBtn} onClick={handleUpgrade} disabled={upgradeLoading}>
                        {upgradeLoading ? t("subscription.redirecting") : t("subscription.resubscribe")}
                        {!upgradeLoading && <ArrowRight size={16} />}
                    </button>
                ) : (
                    <button className={styles.cancelBtn} onClick={() => setCancelConfirm(true)}>
                        {t("subscription.cancel")}
                    </button>
                )
            ) : (
                <button className={styles.upgradeBtn} onClick={handleUpgrade} disabled={upgradeLoading}>
                    {upgradeLoading ? t("subscription.redirecting") : t("subscription.upgradeBtn")}
                    {!upgradeLoading && <ArrowRight size={16} />}
                </button>
            )}

            {showWelcome && (
                <div className={`${styles.welcomeBox} ${welcomeLeaving ? styles.welcomeBoxLeaving : ""}`}>
                    <Sparkles size={15} className={styles.welcomeIcon} />
                    <span>{t("subscription.welcomeCloud")}</span>
                </div>
            )}
            {error && <p className={styles.errorMessage}>{error}</p>}
        </div>
    );
};

export default SubscriptionSettings;
