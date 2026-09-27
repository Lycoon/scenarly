"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowBigUp } from "lucide-react";

import type { MySubmission } from "@src/lib/community/types";
import { MIN_COMPLETED_REVIEWS } from "@src/lib/community/constants";

import styles from "./SubmissionRow.module.css";
import { formatDate } from "./format";

/** One of the author's submissions, as a row of the My submissions table. */
const SubmissionRow = ({ submission }: { submission: MySubmission }) => {
    const t = useTranslations("community.submissions");
    const tEnum = useTranslations("community.enums");

    const inCoverage = submission.status !== "SHOWCASE_ONLY";
    const statusLabel = {
        POOLED: t("statusPooled", { date: formatDate(submission.poolExitAt) }),
        RETIRED: t("statusRetired"),
        SHOWCASE_ONLY: t("statusShowcaseOnly"),
        REMOVED: t("statusRemoved"),
    }[submission.status];
    const reviews = t("reviewsProgress", { count: submission.completedReviewCount, min: MIN_COMPLETED_REVIEWS });
    const upvotes = submission.showcase && (
        <span className={styles.upvotes} title={t("upvotes", { count: submission.showcase.upvoteCount })}>
            <ArrowBigUp className={styles.icon} size={16} />
            {submission.showcase.upvoteCount}
        </span>
    );

    return (
        <Link href={`/community/submissions/${submission.id}`} className={styles.container}>
            <div className={styles.title_cell}>
                <h2 className={styles.title}>{submission.title}</h2>
                <span className={styles.subtitle}>
                    {tEnum(`formats.${submission.format}`)} · {t("pages", { count: submission.pageCount })}
                </span>
                {/* Phone: the other columns collapse, so surface them inline. */}
                <span className={styles.meta_inline}>
                    <span>{formatDate(submission.createdAt)}</span>
                    <span>·</span>
                    <span>{inCoverage ? reviews : statusLabel}</span>
                    {upvotes}
                </span>
            </div>

            <span className={styles.cell}>{formatDate(submission.createdAt)}</span>

            <span className={styles.cell}>
                {inCoverage ? (
                    <>
                        <span className={styles.cell_line}>{reviews}</span>
                        <span className={`${styles.cell_line} ${styles.cell_sub}`}>{statusLabel}</span>
                        {submission.activeClaims > 0 && (
                            <span className={`${styles.cell_line} ${styles.cell_sub}`}>
                                {t("beingRead", { count: submission.activeClaims })}
                            </span>
                        )}
                    </>
                ) : (
                    "—"
                )}
            </span>

            <span className={styles.cell}>{upvotes || "—"}</span>
        </Link>
    );
};

export default SubmissionRow;
