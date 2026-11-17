"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./project/DangerZone.module.css";

/**
 * The way in and out of a settings tab's second view: the rarely used,
 * destructive actions (deleting a project or the account, exporting the
 * account's data) that stay out of sight until asked for.
 *
 * The way in is a labeled button rather than an icon. It sits beside the tab's
 * Save button, and account deletion behind it has to be findable by someone who
 * has never opened the tab (App Store guideline 5.1.1(v)).
 */
export const DangerZoneOpen = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" className={styles.openBtn} onClick={onClick}>
        {label}
        <ChevronRight size={16} />
    </button>
);

/** Back to the tab's main view. */
export const DangerZoneBack = ({ onClick }: { onClick: () => void }) => {
    const t = useTranslations("common");
    return (
        <button type="button" className={styles.backBtn} onClick={onClick}>
            <ChevronLeft size={16} />
            {t("back")}
        </button>
    );
};
