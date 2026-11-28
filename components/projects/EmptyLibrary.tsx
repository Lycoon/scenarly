"use client";

import { ChevronRight, FileDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { join } from "@src/lib/utils/misc";

import styles from "./EmptyLibrary.module.css";

interface EmptyLibraryProps {
    onCreate: () => void;
    onImport: () => void;
    isImporting: boolean;
    importError: string | null;
}

/**
 * The empty library, on desktop and phone. A bare "No projects yet" left a
 * first-time user staring at a blank page — on phone with the only way forward
 * hidden behind the drawer's burger — so this puts the two ways in front of them.
 *
 * The illustration is plain boxes painted with theme tokens, so it follows
 * every theme without per-theme artwork.
 */
const EmptyLibrary = ({ onCreate, onImport, isImporting, importError }: EmptyLibraryProps) => {
    const t = useTranslations("projects");

    return (
        <div className={styles.container}>
            <div className={styles.art} aria-hidden>
                <div className={styles.glow} />
                <div className={join(styles.sheet, styles.sheet_back)} />
                <div className={join(styles.sheet, styles.sheet_mid)} />
                <div className={join(styles.sheet, styles.sheet_front)}>
                    <span className={join(styles.line, styles.line_heading)} />
                    <span className={join(styles.line, styles.line_action)} />
                    <span className={join(styles.line, styles.line_action, styles.line_short)} />
                    <span className={join(styles.line, styles.line_character)} />
                    <span className={join(styles.line, styles.line_dialogue)} />
                    <span className={styles.caret_row}>
                        <span className={join(styles.line, styles.line_dialogue_short)} />
                        <span className={styles.caret} />
                    </span>
                </div>
                <div className={styles.badge}>
                    <Plus size={18} strokeWidth={2.5} />
                </div>
            </div>

            <h2 className={styles.title}>{t("empty.title")}</h2>
            <p className={styles.subtitle}>{t("empty.subtitle")}</p>

            <div className={styles.actions}>
                <button className={join(styles.action, styles.action_primary)} onClick={onCreate}>
                    <span className={styles.action_icon}>
                        <Plus size={20} />
                    </span>
                    <span className={styles.action_text}>
                        <span className={styles.action_label}>{t("empty.createFirst")}</span>
                        <span className={styles.action_desc}>{t("empty.createDesc")}</span>
                    </span>
                    <ChevronRight size={18} className={styles.action_chevron} />
                </button>

                <button className={styles.action} onClick={onImport} disabled={isImporting}>
                    <span className={styles.action_icon}>
                        <FileDown size={20} />
                    </span>
                    <span className={styles.action_text}>
                        <span className={styles.action_label}>
                            {isImporting ? t("importing") : t("empty.importExisting")}
                        </span>
                        <span className={styles.action_desc}>{t("empty.importDesc")}</span>
                    </span>
                    <ChevronRight size={18} className={styles.action_chevron} />
                </button>
            </div>

            {/* The sidebar's copy of this error is inside the closed drawer. */}
            {importError && (
                <p className={styles.error} role="alert">
                    {importError}
                </p>
            )}
        </div>
    );
};

export default EmptyLibrary;
