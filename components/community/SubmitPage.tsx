"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import styles from "./Community.module.css";
import SubmitForm from "./SubmitForm";

/** `/community/coverage/submit`: upload a PDF. The Scenarly-project path lives in the editor's Export tab. */
const SubmitPage = () => {
    const t = useTranslations("community.submit");
    const router = useRouter();

    return (
        <div className={styles.page}>
            <div className={`${styles.pageInner} ${styles.pageInnerNarrow}`}>
                <div className={styles.section} style={{ gap: 6 }}>
                    <h1 className={styles.pageTitle}>{t("title")}</h1>
                    <p className={styles.pageSubtitle}>{t("subtitle")}</p>
                </div>
                <SubmitForm
                    source={{ kind: "upload" }}
                    onSubmitted={(id) => router.push(`/community/coverage/submissions/${id}`)}
                />
            </div>
        </div>
    );
};

export default SubmitPage;
