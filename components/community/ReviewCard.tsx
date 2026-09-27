"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";

import Dropdown from "@components/utils/Dropdown";
import { CommunityRating, CommunityReportReason } from "@src/generated/client/browser";
import type { ReceivedReview } from "@src/lib/community/types";
import { isApiError, rateReview, reportReview } from "@src/lib/community/requests";

import styles from "./Community.module.css";
import { formatDate } from "./format";

interface ReviewCardProps {
    review: ReceivedReview;
    onChanged: () => void;
}

/** A review the author received: three sections, a one-time Useful / Not useful verdict, and a report action. */
const ReviewCard = ({ review, onChanged }: ReviewCardProps) => {
    const t = useTranslations("community.reviews");
    const tEnum = useTranslations("community.enums");
    const tCommon = useTranslations("common");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reporting, setReporting] = useState(false);
    const [reason, setReason] = useState<CommunityReportReason>(CommunityReportReason.LOW_EFFORT);
    const [details, setDetails] = useState("");

    const onRate = async (rating: CommunityRating) => {
        setBusy(true);
        setError(null);
        try {
            await rateReview(review.claimId, rating);
            onChanged();
        } catch (e) {
            setError(isApiError(e) ? e.message : t("rateFailed"));
        } finally {
            setBusy(false);
        }
    };

    const onReport = async () => {
        setBusy(true);
        setError(null);
        try {
            await reportReview(review.claimId, reason, details.trim() || undefined);
            setReporting(false);
            onChanged();
        } catch (e) {
            setError(isApiError(e) ? e.message : t("reportFailed"));
        } finally {
            setBusy(false);
        }
    };

    const sections: { key: string; text: string }[] = [
        { key: "worksWell", text: review.worksWell },
        { key: "doesNotWork", text: review.doesNotWork },
        { key: "remarks", text: review.remarks },
    ];

    return (
        <div className={styles.card} style={{ gap: 16 }}>
            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <span className={styles.cardTitle}>
                    {review.reviewer ?? t("reviewerN", { n: review.position })}
                </span>
                <div className={styles.cardMeta}>
                    <span>{formatDate(review.submittedAt)}</span>
                    <span>{t("words", { count: review.wordCount })}</span>
                    {review.autoSubmitted && <span>{t("autoSubmitted")}</span>}
                </div>
            </div>

            {sections.map((s) =>
                s.text.trim() ? (
                    <div key={s.key} className={styles.field}>
                        <span className={styles.label}>{t(`${s.key}Label`)}</span>
                        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: "0.92rem" }}>{s.text}</p>
                    </div>
                ) : null,
            )}

            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                {review.rating ? (
                    <span className={styles.muted}>
                        {review.rating === CommunityRating.USEFUL ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}{" "}
                        {t("rated", { rating: tEnum(`ratings.${review.rating}`) })}
                    </span>
                ) : (
                    <div className={styles.row}>
                        <span className={styles.muted}>{t("ratePrompt")}</span>
                        <button className={`${styles.btn} ${styles.btnOutline}`} disabled={busy} onClick={() => onRate(CommunityRating.USEFUL)}>
                            <ThumbsUp size={14} /> {tEnum("ratings.USEFUL")}
                        </button>
                        <button className={`${styles.btn} ${styles.btnOutline}`} disabled={busy} onClick={() => onRate(CommunityRating.NOT_USEFUL)}>
                            <ThumbsDown size={14} /> {tEnum("ratings.NOT_USEFUL")}
                        </button>
                    </div>
                )}
                {review.reported ? (
                    <span className={styles.hint}>{t("reported")}</span>
                ) : (
                    !reporting && (
                        <button className={`${styles.btn} ${styles.btnQuiet}`} disabled={busy} onClick={() => setReporting(true)}>
                            <Flag size={14} /> {t("report")}
                        </button>
                    )
                )}
            </div>

            {reporting && (
                <div className={styles.section} style={{ gap: 10 }}>
                    <span className={styles.label}>{t("reportReason")}</span>
                    <Dropdown
                        value={reason}
                        onChange={(v) => setReason(v as CommunityReportReason)}
                        options={Object.values(CommunityReportReason).map((r) => ({ value: r, label: tEnum(`reportReasons.${r}`) }))}
                        className={styles.input}
                        portal
                    />
                    <textarea
                        className={styles.textarea}
                        style={{ minHeight: 80 }}
                        value={details}
                        maxLength={2000}
                        placeholder={t("reportDetails")}
                        onChange={(e) => setDetails(e.target.value)}
                    />
                    <div className={`${styles.row} ${styles.rowEnd}`}>
                        <button className={`${styles.btn} ${styles.btnQuiet}`} disabled={busy} onClick={() => setReporting(false)}>
                            {tCommon("cancel")}
                        </button>
                        <button className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={onReport}>
                            {t("reportSend")}
                        </button>
                    </div>
                </div>
            )}

            {error && <span className={styles.error}>{error}</span>}
        </div>
    );
};

export default ReviewCard;
