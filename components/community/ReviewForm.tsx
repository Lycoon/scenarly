"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import debounce from "debounce";

import Switch from "@components/utils/Switch";
import type { ClaimView } from "@src/lib/community/types";
import { reviewWordCount } from "@src/lib/community/rules";
import { MIN_REVIEW_WORDS } from "@src/lib/community/constants";
import { isApiError, releaseClaim, saveDraft, submitReview, type DraftFields } from "@src/lib/community/requests";

import styles from "./Community.module.css";
import { formatDate } from "./format";

interface ReviewFormProps {
    claim: ClaimView;
    /** Called once the claim is over — sent, given up, or found ended elsewhere — so the page can refetch. */
    onEnded: (how: "submitted" | "released" | "gone") => void;
}

const AUTOSAVE_MS = 2000;

/**
 * The three sections of a review with a live word count against the minimum.
 * Saves the draft two seconds after the last keystroke and on blur; Submit is
 * disabled until the 7-day floor, with the date it opens. A saved draft over
 * the minimum is sent automatically at the floor (the tick does it), and the
 * form says so.
 */
const ReviewForm = ({ claim, onEnded }: ReviewFormProps) => {
    const t = useTranslations("community.review");
    const tCommon = useTranslations("common");

    const [worksWell, setWorksWell] = useState(claim.review?.worksWell ?? "");
    const [doesNotWork, setDoesNotWork] = useState(claim.review?.doesNotWork ?? "");
    const [remarks, setRemarks] = useState(claim.review?.remarks ?? "");
    const [signed, setSigned] = useState(claim.review?.signed ?? false);
    const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving" | "saved" | "error">("clean");
    const [savedAt, setSavedAt] = useState<string | null>(claim.review?.updatedAt ?? null);
    const [busy, setBusy] = useState<"idle" | "submitting" | "releasing">("idle");
    const [error, setError] = useState<string | null>(null);
    const [confirmRelease, setConfirmRelease] = useState(false);

    const words = reviewWordCount({ worksWell, doesNotWork, remarks });
    const longEnough = words >= MIN_REVIEW_WORDS;

    // The saver takes the fields as arguments so the debounced call always
    // carries the latest values without the hook closing over state.
    const save = useCallback(
        async (fields: DraftFields) => {
            setSaveState("saving");
            try {
                const res = await saveDraft(claim.id, fields);
                setSavedAt(res.updatedAt);
                setSaveState("saved");
            } catch (e) {
                setSaveState("error");
                if (isApiError(e) && (e.code === "CLAIM_ENDED" || e.code === "ALREADY_SUBMITTED")) onEnded("gone");
            }
        },
        [claim.id, onEnded],
    );

    // One debounced saver for the life of the form; flushed on unmount so a
    // navigation away never loses the last keystrokes.
    const debouncedSave = useMemo(() => debounce(save, AUTOSAVE_MS), [save]);
    useEffect(() => () => debouncedSave.flush(), [debouncedSave]);

    const queueSave = (next: DraftFields) => {
        setSaveState("dirty");
        debouncedSave(next);
    };

    const onChange = (key: keyof DraftFields, setter: (v: string) => void) => (v: string) => {
        setter(v);
        queueSave({ worksWell, doesNotWork, remarks, signed, [key]: v });
    };

    const onSigned = (next: boolean) => {
        setSigned(next);
        queueSave({ worksWell, doesNotWork, remarks, signed: next });
    };

    const onSubmit = async () => {
        setBusy("submitting");
        setError(null);
        try {
            debouncedSave.clear();
            await save({ worksWell, doesNotWork, remarks, signed });
            await submitReview(claim.id);
            onEnded("submitted");
        } catch (e) {
            setError(isApiError(e) ? e.message : t("submitFailed"));
            setBusy("idle");
        }
    };

    const onRelease = async () => {
        setBusy("releasing");
        setError(null);
        try {
            debouncedSave.clear();
            await releaseClaim(claim.id);
            onEnded("released");
        } catch (e) {
            setError(isApiError(e) ? e.message : t("releaseFailed"));
            setBusy("idle");
        }
    };

    const sections: { key: "worksWell" | "doesNotWork" | "remarks"; value: string; set: (v: string) => void }[] = [
        { key: "worksWell", value: worksWell, set: setWorksWell },
        { key: "doesNotWork", value: doesNotWork, set: setDoesNotWork },
        { key: "remarks", value: remarks, set: setRemarks },
    ];

    return (
        <div className={styles.card} style={{ gap: 16 }}>
            {sections.map((s) => (
                <div key={s.key} className={styles.field}>
                    <label className={styles.label}>{t(`${s.key}Label`)}</label>
                    <textarea
                        className={styles.textarea}
                        value={s.value}
                        placeholder={t(`${s.key}Placeholder`)}
                        onChange={(e) => onChange(s.key, s.set)(e.target.value)}
                        onBlur={() => saveState === "dirty" && debouncedSave.flush()}
                        disabled={busy !== "idle"}
                    />
                </div>
            ))}

            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <span className={longEnough ? styles.success : styles.muted}>
                    {t("wordCount", { count: words, min: MIN_REVIEW_WORDS })}
                </span>
                <span className={styles.hint}>
                    {saveState === "saving" && t("saving")}
                    {saveState === "saved" && savedAt && t("savedAt", { time: formatDate(savedAt, true) })}
                    {saveState === "dirty" && t("unsaved")}
                    {saveState === "error" && t("saveFailed")}
                    {saveState === "clean" && savedAt && t("savedAt", { time: formatDate(savedAt, true) })}
                </span>
            </div>

            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <div className={styles.section} style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t("signLabel")}</span>
                    <span className={styles.hint}>{t("signHint")}</span>
                </div>
                <Switch checked={signed} onChange={onSigned} disabled={busy !== "idle"} ariaLabel={t("signLabel")} />
            </div>

            <p className={styles.hint}>
                {claim.canSubmit ? t("floorPassed") : t("autoSendNote", { date: formatDate(claim.floorAt) })}
            </p>

            {error && <span className={styles.error}>{error}</span>}

            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                {confirmRelease ? (
                    <div className={styles.row}>
                        <span className={styles.muted}>{t("releaseConfirm")}</span>
                        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onRelease} disabled={busy !== "idle"}>
                            {busy === "releasing" ? t("releasing") : t("releaseYes")}
                        </button>
                        <button className={`${styles.btn} ${styles.btnQuiet}`} onClick={() => setConfirmRelease(false)}>
                            {tCommon("cancel")}
                        </button>
                    </div>
                ) : (
                    <button className={`${styles.btn} ${styles.btnQuiet}`} onClick={() => setConfirmRelease(true)} disabled={busy !== "idle"}>
                        {t("release")}
                    </button>
                )}
                <button
                    className={styles.btn}
                    onClick={onSubmit}
                    disabled={busy !== "idle" || !claim.canSubmit || !longEnough}
                    title={!claim.canSubmit ? t("opensOn", { date: formatDate(claim.floorAt) }) : undefined}
                >
                    {busy === "submitting"
                        ? t("submitting")
                        : claim.canSubmit
                          ? t("submit")
                          : t("opensOn", { date: formatDate(claim.floorAt) })}
                </button>
            </div>
        </div>
    );
};

export default ReviewForm;
