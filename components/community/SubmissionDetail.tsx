"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowBigUp, ArrowLeft, ExternalLink, Eye, Hash, Trash2 } from "lucide-react";
import { useSWRConfig } from "swr";

import Loading from "@components/utils/Loading";
import { useCommunityMe, useSubmission } from "@src/lib/community/hooks";
import {
    getSubmissionPdfUrl,
    isApiError,
    publishToShowcase,
    unpublishFromShowcase,
    withdrawSubmission,
} from "@src/lib/community/requests";
import { MIN_COMPLETED_REVIEWS, SUBMISSION_COST } from "@src/lib/community/constants";
import { FULL_KIND_BY_FORMAT } from "@src/lib/community/showcase";
import type { SubmissionDetail as SubmissionDetailView } from "@src/lib/community/types";

import styles from "./Community.module.css";
import PdfViewer from "./PdfViewer";
import ReviewCard from "./ReviewCard";
import { Chip } from "./SubmitForm";
import { formatDate } from "./format";

/** `/community/submissions/[id]`: status, the reviews received, the frozen PDF, Showcase, withdraw. */
const SubmissionDetail = ({ submissionId }: { submissionId: string }) => {
    const t = useTranslations("community.submissions");
    const tEnum = useTranslations("community.enums");
    const tCommon = useTranslations("common");
    const router = useRouter();
    const { mutate } = useSWRConfig();
    const { mutate: mutateMe } = useCommunityMe();
    const { submission, isLoading, mutate: refresh, error } = useSubmission(submissionId);

    const [showPdf, setShowPdf] = useState(false);
    const [confirmWithdraw, setConfirmWithdraw] = useState(false);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className={styles.page}>
                <Loading />
            </div>
        );
    }
    if (error || !submission) {
        return (
            <div className={styles.page}>
                <div className={`${styles.pageInner} ${styles.pageInnerNarrow}`}>
                    <div className={styles.notice}>
                        <span className={styles.noticeTitle}>{t("notFound")}</span>
                        <Link href="/community/submissions" className={styles.btn}>
                            {tCommon("back")}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const pooled = submission.status === "POOLED";
    // Never went through Coverage: no reviews to show or keep.
    const showcaseOnly = submission.status === "SHOWCASE_ONLY";
    const neverClaimed = submission.activeClaims === 0 && submission.reviews.length === 0;

    const onWithdraw = async () => {
        setBusy(true);
        setActionError(null);
        try {
            await withdrawSubmission(submission.id);
            await Promise.all([mutate("/api/community/submissions"), mutateMe()]);
            router.push("/community/submissions");
        } catch (e) {
            setActionError(isApiError(e) ? e.message : t("withdrawFailed"));
            setBusy(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                <Link href="/community/submissions" className={styles.link} style={{ textDecoration: "none", display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <ArrowLeft size={14} /> {tCommon("back")}
                </Link>

                <div className={styles.pageHeader}>
                    <div className={styles.section} style={{ gap: 6 }}>
                        <h1 className={styles.pageTitle}>{submission.title}</h1>
                        <div className={styles.cardMeta}>
                            <span className={styles.tag}>{tEnum(`formats.${submission.format}`)}</span>
                            {submission.genres.map((g) => (
                                <span key={g} className={styles.tag}>
                                    {tEnum(`genres.${g}`)}
                                </span>
                            ))}
                            <span>{t("pages", { count: submission.pageCount })}</span>
                            <span>{t("submittedOn", { date: formatDate(submission.createdAt) })}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setShowPdf((v) => !v)}>
                            <Eye size={16} /> {showPdf ? t("hidePdf") : t("viewPdf")}
                        </button>
                    </div>
                </div>

                <p className={styles.pageSubtitle}>{submission.logline}</p>

                <div className={styles.card} style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>
                        {pooled
                            ? t("poolStatus", { count: submission.completedReviewCount, min: MIN_COMPLETED_REVIEWS, date: formatDate(submission.poolExitAt) })
                            : submission.status === "RETIRED"
                              ? t("retiredStatus", { date: formatDate(submission.retiredAt) })
                              : t("statusShowcaseOnly")}
                    </span>
                    {submission.activeClaims > 0 && <span className={styles.muted}>{t("beingRead", { count: submission.activeClaims })}</span>}
                    <span className={styles.hint} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Hash size={12} /> {t("proof", { hash: submission.sha256.slice(0, 16), date: formatDate(submission.createdAt, true) })}
                    </span>
                </div>

                {showPdf && <PdfViewer getUrl={() => getSubmissionPdfUrl(submission.id)} />}

                <ShowcaseSection submission={submission} onChanged={() => Promise.all([refresh(), mutate("/api/community/submissions")])} />

                {!showcaseOnly && (
                    <div className={styles.section}>
                        <span className={styles.sectionTitle}>{t("reviewsTitle", { count: submission.reviews.length })}</span>
                        {submission.reviews.length === 0 ? (
                            <div className={styles.notice}>
                                <span className={styles.noticeTitle}>{t("noReviewsTitle")}</span>
                                <p className={styles.muted}>{pooled ? t("noReviewsBodyPooled") : t("noReviewsBodyRetired")}</p>
                            </div>
                        ) : (
                            submission.reviews.map((r) => <ReviewCard key={r.claimId} review={r} onChanged={() => refresh()} />)
                        )}
                    </div>
                )}

                <div className={styles.section}>
                    <span className={styles.sectionTitle}>{t("dangerTitle")}</span>
                    <div className={styles.card}>
                        <p className={styles.muted}>
                            {pooled && neverClaimed
                                ? t("withdrawRefund", { cost: SUBMISSION_COST })
                                : pooled
                                  ? t("withdrawNoRefund")
                                  : showcaseOnly
                                    ? t("withdrawShowcase")
                                    : t("withdrawRetired")}
                        </p>
                        {actionError && <span className={styles.error}>{actionError}</span>}
                        {confirmWithdraw ? (
                            <div className={styles.row}>
                                <button className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={onWithdraw}>
                                    {busy ? t("withdrawing") : t("withdrawYes")}
                                </button>
                                <button className={`${styles.btn} ${styles.btnQuiet}`} disabled={busy} onClick={() => setConfirmWithdraw(false)}>
                                    {tCommon("cancel")}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.row}>
                                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setConfirmWithdraw(true)}>
                                    <Trash2 size={16} /> {t("withdraw")}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Where the submission stands on Showcase: its public page and upvotes when
 * published, else the choice of what to show and the button to publish.
 */
const ShowcaseSection = ({ submission, onChanged }: { submission: SubmissionDetailView; onChanged: () => Promise<unknown> }) => {
    const t = useTranslations("community.submissions");
    const tSubmit = useTranslations("community.submit");
    const tEnum = useTranslations("community.enums");
    const [loglineOnly, setLoglineOnly] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const entry = submission.showcase;

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            await onChanged();
        } catch (e) {
            setError(isApiError(e) ? e.message : t("showcaseFailed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.section}>
            <span className={styles.sectionTitle}>{t("showcaseTitle")}</span>
            <div className={styles.card}>
                {entry ? (
                    <>
                        <div className={styles.row} style={{ justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 600 }}>{t("showcaseLive", { kind: tEnum(`showcaseKinds.${entry.kind}`) })}</span>
                            <span className={styles.muted} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <ArrowBigUp size={16} /> {t("upvotes", { count: entry.upvoteCount })}
                            </span>
                        </div>
                        <div className={styles.row}>
                            <Link href={`/community/showcase/${entry.slug}`} className={`${styles.btn} ${styles.btnOutline}`}>
                                <ExternalLink size={16} /> {t("showcaseOpen")}
                            </Link>
                            <button
                                className={`${styles.btn} ${styles.btnQuiet}`}
                                disabled={busy}
                                onClick={() => run(() => unpublishFromShowcase(submission.id))}
                            >
                                {busy ? t("showcaseUnpublishing") : t("showcaseUnpublish")}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className={styles.muted}>{t("showcaseOff")}</p>
                        <div className={styles.field}>
                            <span className={styles.label}>{tSubmit("showLabel")}</span>
                            <div className={styles.row} style={{ gap: 6 }}>
                                <Chip on={!loglineOnly} onClick={() => setLoglineOnly(false)}>
                                    {tSubmit("showScript")}
                                </Chip>
                                <Chip on={loglineOnly} onClick={() => setLoglineOnly(true)}>
                                    {tSubmit("showLogline")}
                                </Chip>
                            </div>
                        </div>
                        <div className={styles.row}>
                            <button
                                className={styles.btn}
                                disabled={busy}
                                onClick={() =>
                                    run(() => publishToShowcase(submission.id, loglineOnly ? "LOGLINE" : FULL_KIND_BY_FORMAT[submission.format]))
                                }
                            >
                                {busy ? t("showcasePublishing") : t("showcasePublish")}
                            </button>
                        </div>
                    </>
                )}
                {error && <span className={styles.error}>{error}</span>}
            </div>
        </div>
    );
};

export default SubmissionDetail;
