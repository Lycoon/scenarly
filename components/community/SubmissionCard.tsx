"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileText, MessageSquare } from "lucide-react";

import type { MySubmission } from "@src/lib/community/types";
import { MIN_COMPLETED_REVIEWS } from "@src/lib/community/constants";

import styles from "./Community.module.css";
import { formatDate } from "./format";

/** One of the author's submissions, as listed on the Coverage dashboard. */
const SubmissionCard = ({ submission }: { submission: MySubmission }) => {
    const t = useTranslations("community.submissions");
    const tEnum = useTranslations("community.enums");

    const statusLabel = {
        POOLED: t("statusPooled", { date: formatDate(submission.poolExitAt) }),
        RETIRED: t("statusRetired"),
        SHOWCASE_ONLY: t("statusShowcaseOnly"),
        REMOVED: t("statusRemoved"),
    }[submission.status];

    return (
        <Link href={`/community/coverage/submissions/${submission.id}`} className={styles.card} style={{ textDecoration: "none" }}>
            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <span className={styles.cardTitle}>{submission.title}</span>
                <span className={styles.tag}>{tEnum(`formats.${submission.format}`)}</span>
            </div>
            <p className={styles.muted} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {submission.logline}
            </p>
            <div className={styles.cardMeta}>
                <span>
                    <FileText size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {t("pages", { count: submission.pageCount })}
                </span>
                {submission.status !== "SHOWCASE_ONLY" && (
                    <span>
                        <MessageSquare size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        {t("reviewsProgress", { count: submission.completedReviewCount, min: MIN_COMPLETED_REVIEWS })}
                    </span>
                )}
                {submission.activeClaims > 0 && <span>{t("beingRead", { count: submission.activeClaims })}</span>}
                <span>{statusLabel}</span>
            </div>
        </Link>
    );
};

export default SubmissionCard;
