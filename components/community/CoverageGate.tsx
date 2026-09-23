"use client";

import { ReactNode, useContext } from "react";
import { useTranslations } from "next-intl";

import Loading from "@components/utils/Loading";
import { DashboardContext } from "@src/context/DashboardContext";
import { useCommunityMe } from "@src/lib/community/hooks";

import styles from "./Community.module.css";
import { formatDate } from "./format";

/**
 * Wraps every Coverage page. Resolves, in order: session → entry gate, and
 * renders the matching card instead of the page until both pass (`/community/me`
 * creates the profile of an eligible user). The page itself is rendered dimmed
 * behind a gate card so a visitor sees what they will get.
 */
const CoverageGate = ({ children }: { children: ReactNode }) => {
    const t = useTranslations("community.gate");
    const { me, user, isLoading } = useCommunityMe();
    const { openDashboard } = useContext(DashboardContext);

    if (isLoading) {
        return (
            <div className={styles.page}>
                <Loading />
            </div>
        );
    }

    if (!user) {
        return (
            <Gated>
                <span className={styles.noticeTitle}>{t("signedOutTitle")}</span>
                <p className={styles.muted}>{t("signedOutBody")}</p>
                <button className={styles.btn} onClick={() => openDashboard("Auth")}>
                    {t("signIn")}
                </button>
            </Gated>
        );
    }

    if (!me) return null;

    if (me.profile) return <>{children}</>;

    const unverified = me.eligibility.reason === "UNVERIFIED";
    return (
        <Gated>
            <span className={styles.noticeTitle}>{unverified ? t("unverifiedTitle") : t("tooRecentTitle")}</span>
            <p className={styles.muted}>
                {unverified ? t("unverifiedBody") : t("tooRecentBody", { date: formatDate(me.eligibility.eligibleAt) })}
            </p>
        </Gated>
    );
};

/** A gate card above a dimmed preview of the dashboard's empty state. */
const Gated = ({ children }: { children: ReactNode }) => {
    const t = useTranslations("community.dashboard");
    return (
        <div className={styles.page}>
            <div className={`${styles.pageInner} ${styles.pageInnerNarrow}`}>
                <div className={styles.notice}>{children}</div>
                <div className={`${styles.grid} ${styles.dimmed}`} aria-hidden>
                    <div className={styles.card}>
                        <span className={styles.cardTitle}>{t("submitCard")}</span>
                        <p className={styles.muted}>{t("submitCardBody")}</p>
                    </div>
                    <div className={styles.card}>
                        <span className={styles.cardTitle}>{t("reviewCard")}</span>
                        <p className={styles.muted}>{t("reviewCardBody")}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoverageGate;
