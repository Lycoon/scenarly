"use client";

import { ReactNode, useContext, useState } from "react";
import { useTranslations } from "next-intl";
import { useSWRConfig } from "swr";

import Loading from "@components/utils/Loading";
import { DashboardContext } from "@src/context/DashboardContext";
import { useCommunityMe } from "@src/lib/community/hooks";
import { isApiError, joinCommunity } from "@src/lib/community/requests";
import { PEN_NAME_MAX_LENGTH, PEN_NAME_MIN_LENGTH, STARTER_CREDITS } from "@src/lib/community/constants";

import styles from "./Community.module.css";
import { formatDate } from "./format";

/**
 * Wraps every Coverage page. Resolves, in order: session → entry gate → membership,
 * and renders the matching card instead of the page until all three pass. The
 * page itself is rendered dimmed behind a gate card so a visitor sees what they
 * will get.
 */
const CoverageGate = ({ children }: { children: ReactNode }) => {
    const t = useTranslations("community.gate");
    const { me, user, isLoading, mutate } = useCommunityMe();
    const { openDashboard } = useContext(DashboardContext);
    const { mutate: mutateGlobal } = useSWRConfig();

    const [penName, setPenName] = useState("");
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    if (!me.eligibility.ok) {
        const unverified = me.eligibility.reason === "UNVERIFIED";
        return (
            <Gated>
                <span className={styles.noticeTitle}>{unverified ? t("unverifiedTitle") : t("tooRecentTitle")}</span>
                <p className={styles.muted}>
                    {unverified
                        ? t("unverifiedBody")
                        : t("tooRecentBody", { date: formatDate(me.eligibility.eligibleAt) })}
                </p>
            </Gated>
        );
    }

    const onJoin = async () => {
        const name = penName.trim();
        if (name.length < PEN_NAME_MIN_LENGTH) return setError(t("penNameTooShort", { min: PEN_NAME_MIN_LENGTH }));
        setJoining(true);
        setError(null);
        try {
            await joinCommunity(name);
            await mutate();
            await mutateGlobal("/api/community/submissions");
        } catch (e) {
            setError(isApiError(e) ? e.message : t("joinFailed"));
        } finally {
            setJoining(false);
        }
    };

    return (
        <Gated>
            <span className={styles.noticeTitle}>{t("joinTitle")}</span>
            <p className={styles.muted}>{t("joinBody", { credits: STARTER_CREDITS })}</p>
            <div className={styles.field} style={{ width: "100%", maxWidth: 360 }}>
                <label className={styles.label} htmlFor="community-pen-name">
                    {t("penName")}
                </label>
                <input
                    id="community-pen-name"
                    className={styles.input}
                    value={penName}
                    maxLength={PEN_NAME_MAX_LENGTH}
                    placeholder={t("penNamePlaceholder")}
                    onChange={(e) => setPenName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onJoin()}
                />
                <span className={styles.hint}>{t("penNameHint")}</span>
            </div>
            {error && <span className={styles.error}>{error}</span>}
            <button className={styles.btn} onClick={onJoin} disabled={joining}>
                {joining ? t("joining") : t("join")}
            </button>
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
