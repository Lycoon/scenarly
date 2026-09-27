"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import Loading from "@components/utils/Loading";
import { useMySubmissions } from "@src/lib/community/hooks";

import page from "@components/projects/ProjectPageContainer.module.css";
import styles from "./Community.module.css";
import row from "./SubmissionRow.module.css";
import SubmissionRow from "./SubmissionRow";

/**
 * `/community/submissions`: everything the member submitted, newest first,
 * whichever half it went to, laid out like the projects library. One list:
 * the navbar already switches between Showcase and Coverage, and each row says
 * where its script is (in the pool, Showcase only, on Showcase with its upvotes).
 */
const MySubmissions = () => {
    const t = useTranslations("community.mySubmissions");
    const tSubmit = useTranslations("community.submit");
    const { submissions, isLoading } = useMySubmissions();

    if (isLoading) return <Loading />;

    return (
        <div className={row.list}>
            <div className={page.list_header}>
                <span>{t("columns.title")}</span>
                <span>{t("columns.submitted")}</span>
                <span>{t("columns.coverage")}</span>
                <span>{t("columns.showcase")}</span>
            </div>
            <div className={page.list_scroll}>
                {submissions && submissions.length > 0 ? (
                    <div className={page.rows}>
                        {submissions.map((s) => (
                            <SubmissionRow key={s.id} submission={s} />
                        ))}
                    </div>
                ) : (
                    <div className={page.rows}>
                        <div className={styles.notice}>
                            <span className={styles.noticeTitle}>{t("emptyTitle")}</span>
                            <p className={styles.muted}>{t("emptyBody")}</p>
                            <Link href="/community/submit" className={styles.btn}>
                                {tSubmit("title")}
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MySubmissions;
