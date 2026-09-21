"use client";

import { useTranslations } from "next-intl";

import styles from "./Community.module.css";

/** Stand-in for `/community/showcase` until the public wall ships. */
const ShowcasePlaceholder = () => {
    const t = useTranslations("community.showcase");
    return (
        <div className={styles.page}>
            <div className={`${styles.pageInner} ${styles.pageInnerNarrow}`}>
                <div className={styles.notice}>
                    <span className={styles.noticeTitle}>{t("comingSoonTitle")}</span>
                    <p className={styles.muted}>{t("comingSoonBody")}</p>
                </div>
            </div>
        </div>
    );
};

export default ShowcasePlaceholder;
