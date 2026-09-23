"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

import Loading from "@components/utils/Loading";
import { useCommunityMe, useTickets, useEndedClaims, useMySubmissions } from "@src/lib/community/hooks";

import styles from "./Community.module.css";
import SubmissionCard from "./SubmissionCard";
import { daysUntil, formatDate } from "./format";

type Tab = "submissions" | "reviews" | "tickets";

/** `/community/coverage`: balance, the claim in progress, and the member's history in three tabs. */
const CoverageDashboard = () => {
    const t = useTranslations("community.dashboard");
    const tClaim = useTranslations("community.claim");
    const tEnum = useTranslations("community.enums");
    const { me } = useCommunityMe();
    const [tab, setTab] = useState<Tab>("submissions");
    const { submissions, isLoading: loadingSubmissions } = useMySubmissions(tab === "submissions");
    const { claims, isLoading: loadingClaims } = useEndedClaims(tab === "reviews");
    const { entries, isLoading: loadingTickets } = useTickets(tab === "tickets");

    if (!me?.profile) return null;
    const claim = me.activeClaim;

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                {claim && (
                    <div className={styles.banner}>
                        <div className={styles.section} style={{ gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>{tClaim("inProgress", { title: claim.submission.title })}</span>
                            <span className={styles.muted}>
                                {claim.canSubmit
                                    ? tClaim("canSubmitNow")
                                    : tClaim("canSubmitFrom", { date: formatDate(claim.floorAt) })}
                                {" · "}
                                {tClaim("deadlineIn", { days: Math.max(0, daysUntil(claim.deadlineAt)) })}
                            </span>
                        </div>
                        <Link href="/community/coverage/review" className={styles.btn}>
                            {tClaim("continue")}
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                )}

                <div className={styles.section}>
                    <div className={`${styles.row} ${styles.tabRow}`}>
                        {(["submissions", "reviews", "tickets"] as Tab[]).map((id) => (
                            <button
                                key={id}
                                className={`${styles.btn} ${tab === id ? "" : styles.btnOutline}`}
                                onClick={() => setTab(id)}
                            >
                                {t(`tabs.${id}`)}
                            </button>
                        ))}
                    </div>

                    {tab === "submissions" &&
                        (loadingSubmissions ? (
                            <Loading />
                        ) : submissions && submissions.length > 0 ? (
                            <div className={styles.grid}>
                                {submissions.map((s) => (
                                    <SubmissionCard key={s.id} submission={s} />
                                ))}
                            </div>
                        ) : (
                            <div className={styles.notice}>
                                <span className={styles.noticeTitle}>{t("noSubmissionsTitle")}</span>
                                <p className={styles.muted}>{t("noSubmissionsBody")}</p>
                            </div>
                        ))}

                    {tab === "reviews" &&
                        (loadingClaims ? (
                            <Loading />
                        ) : claims && claims.length > 0 ? (
                            <div className={styles.grid}>
                                {claims.map((c) => (
                                    <div key={c.id} className={styles.card}>
                                        <span className={styles.cardTitle}>{c.submission.title}</span>
                                        <div className={styles.cardMeta}>
                                            <span>{tEnum(`claimStatus.${c.status}`)}</span>
                                            <span>{formatDate(c.endedAt ?? c.claimedAt)}</span>
                                            {c.review?.autoSubmitted && <span>{tClaim("autoSubmittedTag")}</span>}
                                            {c.review?.rating && <span>{tEnum(`ratings.${c.review.rating}`)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.notice}>
                                <span className={styles.noticeTitle}>{t("noReviewsTitle")}</span>
                                <p className={styles.muted}>{t("noReviewsBody")}</p>
                            </div>
                        ))}

                    {tab === "tickets" &&
                        (loadingTickets ? (
                            <Loading />
                        ) : (
                            <div className={styles.ledger}>
                                {entries?.map((e) => (
                                    <div key={e.id} className={styles.ledgerRow}>
                                        <span>{tEnum(`ticketReasons.${e.reason}`)}</span>
                                        <span className={styles.muted}>{formatDate(e.createdAt)}</span>
                                        <span className={`${styles.ledgerDelta} ${e.delta > 0 ? styles.ledgerCredit : ""}`}>
                                            {e.delta > 0 ? `+${e.delta}` : e.delta}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

export default CoverageDashboard;
