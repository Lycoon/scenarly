"use client";

import { ReactNode, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, FileText, Ticket, Upload } from "lucide-react";
import { useSWRConfig } from "swr";

import BackButton from "@components/utils/BackButton";
import { CommunityFormat, CommunityGenre } from "@src/generated/client/browser";
import { createSubmission, isApiError, uploadToShowcase } from "@src/lib/community/requests";
import { useCommunityMe } from "@src/lib/community/hooks";
import {
    COVERAGE_PAGE_BOUNDS,
    GENRES_MAX,
    LOGLINE_MAX_LENGTH,
    LOGLINE_MIN_LENGTH,
    MAX_PDF_BYTES,
    PAGE_BOUNDS,
    SUBMISSION_COST,
    TITLE_MAX_LENGTH,
} from "@src/lib/community/constants";

import form from "@components/utils/Form.module.css";
import styles from "./Community.module.css";
import { formatDate } from "./format";

/** Where the PDF comes from: a file the user picks, or the open project's export. */
export type SubmitSource =
    | { kind: "upload" }
    | { kind: "project"; projectId: string; buildPdf: () => Promise<Blob> };

/** Coverage: feature only, costs tickets, gets reviewed. Showcase only: any format, free. */
export type SubmitDestination = "COVERAGE" | "SHOWCASE_ONLY";

/** The form's steps, in order: the file and its format, then what it is about, then its genres. */
type SubmitStep = "script" | "details" | "genres";

interface SubmitFormProps {
    source: SubmitSource;
    /** The page's heading, held above the separator and the steps. A popup leaves it to its own header. */
    title?: ReactNode;
    destination?: SubmitDestination;
    initialTitle?: string;
    initialLogline?: string;
    onSubmitted: (submissionId: string) => void;
    onCancel?: () => void;
    /** Shown at the start of the action row, opposite the submit button. */
    onBack?: () => void;
}

/**
 * The submission form both paths share. The upload path adds a file field; the
 * project path renders the PDF with `buildPdf` at submit time. Coverage takes
 * feature scripts only, so there is no format to pick and the page bounds are
 * fixed; a Showcase-only submission picks its format, which sets the bounds
 * and the kind it is shown as, and costs nothing. Field rules mirror the API's
 * zod schema through the shared constants.
 *
 * The fields come one step at a time under a sticky header — the title, a
 * separator, the steps — so the form never shows everything at once. The
 * script step only exists when there is something to pick: the project path
 * to Coverage starts at the details. Next checks the step it leaves; Submit
 * checks them all and returns to the first one that is wrong.
 */
const SubmitForm = ({
    source,
    title: heading,
    destination = "COVERAGE",
    initialTitle = "",
    initialLogline = "",
    onSubmitted,
    onCancel,
    onBack,
}: SubmitFormProps) => {
    const t = useTranslations("community.submit");
    const tEnum = useTranslations("community.enums");
    const { me, mutate: mutateMe } = useCommunityMe();
    const { mutate } = useSWRConfig();
    const fileInput = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState(initialTitle);
    const [logline, setLogline] = useState(initialLogline);
    const [genres, setGenres] = useState<CommunityGenre[]>([]);
    const [format, setFormat] = useState<CommunityFormat>(CommunityFormat.FEATURE);
    const [busy, setBusy] = useState<"idle" | "rendering" | "uploading">("idle");
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    // The furthest step reached, so the step bar can jump back to it.
    const [reached, setReached] = useState(0);

    const coverage = destination === "COVERAGE";
    const cost = coverage ? SUBMISSION_COST : 0;
    const balance = me?.balance ?? 0;
    const canAfford = balance >= cost;
    const bounds = coverage ? COVERAGE_PAGE_BOUNDS : PAGE_BOUNDS[format];
    const maxMb = Math.round(MAX_PDF_BYTES / 1024 ** 2);

    const toggleGenre = (g: CommunityGenre) =>
        setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < GENRES_MAX ? [...prev, g] : prev));

    const onPickFile = (picked: File | null) => {
        setError(null);
        if (!picked) return setFile(null);
        if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
            return setError(t("errors.notPdf"));
        }
        if (picked.size > MAX_PDF_BYTES) return setError(t("errors.tooLarge", { mb: maxMb }));
        setFile(picked);
    };

    const steps: SubmitStep[] = [...(source.kind === "upload" || !coverage ? (["script"] as const) : []), "details", "genres"];
    const current = steps[step];
    const last = step === steps.length - 1;

    const validateStep = (s: SubmitStep): string | null => {
        switch (s) {
            case "script":
                if (source.kind === "upload" && !file) return t("errors.noFile");
                return null;
            case "details":
                if (!title.trim()) return t("errors.noTitle");
                if (logline.trim().length < LOGLINE_MIN_LENGTH) return t("errors.loglineShort", { min: LOGLINE_MIN_LENGTH });
                return null;
            case "genres":
                return genres.length === 0 ? t("errors.noGenre") : null;
        }
    };

    const goTo = (index: number) => {
        setError(null);
        setStep(index);
        setReached((r) => Math.max(r, index));
    };

    // Tickets are checked on every step so a short balance shows up front, not after the whole form.
    const onNext = () => {
        const problem = canAfford ? validateStep(current) : t("errors.tickets", { cost, balance });
        if (problem) return setError(problem);
        goTo(step + 1);
    };

    const onStepBack = () => (step > 0 ? goTo(step - 1) : onBack?.());

    const onSubmit = async () => {
        for (let i = 0; i < steps.length; i++) {
            const problem = validateStep(steps[i]);
            if (problem) {
                setStep(i);
                return setError(problem);
            }
        }
        if (!canAfford) return setError(t("errors.tickets", { cost, balance }));
        setError(null);
        try {
            let blob: Blob;
            if (source.kind === "project") {
                setBusy("rendering");
                blob = await source.buildPdf();
            } else {
                blob = file!;
            }
            setBusy("uploading");
            const fields = {
                title: title.trim(),
                logline: logline.trim(),
                genres,
                format,
                sourceProjectId: source.kind === "project" ? source.projectId : undefined,
                destination,
            };
            const created = coverage
                ? await createSubmission(blob, fields)
                : await uploadToShowcase(blob, fields);
            await Promise.all([mutateMe(), mutate("/api/community/submissions")]);
            onSubmitted(created.id);
        } catch (e) {
            if (isApiError(e) && e.code === "DUPLICATE_PDF") setError(t("errors.duplicate"));
            else if (isApiError(e) && e.code === "INSUFFICIENT_TICKETS") setError(t("errors.tickets", { cost, balance }));
            else if (isApiError(e) && e.code === "ACCOUNT_TOO_RECENT")
                setError(t("coverageTooRecent", { date: formatDate(me?.eligibility.eligibleAt) }));
            else if (isApiError(e)) setError(e.message);
            else setError(t("errors.failed"));
        } finally {
            setBusy("idle");
        }
    };

    return (
        <div className={styles.section} style={{ gap: 18 }}>
            <div className={styles.formHeader}>
                {heading}
                <ol className={styles.steps}>
                    {steps.map((s, i) => (
                        <li key={s} className={styles.stepItem}>
                            {i > 0 && <span className={styles.stepLine} aria-hidden />}
                            <button
                                type="button"
                                className={`${styles.step} ${i === step ? styles.stepActive : ""}`}
                                onClick={() => goTo(i)}
                                disabled={i === step || i > reached || busy !== "idle"}
                                aria-current={i === step ? "step" : undefined}
                            >
                                <span className={styles.stepNumber}>{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                                <span className={styles.stepLabel}>{t(`steps.${s}`)}</span>
                            </button>
                        </li>
                    ))}
                </ol>
            </div>

            {current === "script" && !coverage && (
                <div className={styles.field}>
                    <label className={form.label}>{t("formatLabel")}</label>
                    <div className={styles.row} style={{ gap: 6 }}>
                        {Object.values(CommunityFormat).map((f) => (
                            <Chip key={f} on={format === f} onClick={() => setFormat(f)}>
                                {tEnum(`formats.${f}`)}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {current === "script" && source.kind === "upload" && (
                <div
                    className={styles.notice}
                    style={{ cursor: "pointer", alignItems: "center", textAlign: "center" }}
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        onPickFile(e.dataTransfer.files?.[0] ?? null);
                    }}
                >
                    <input
                        ref={fileInput}
                        type="file"
                        accept="application/pdf,.pdf"
                        hidden
                        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    />
                    {file ? <FileText size={22} /> : <Upload size={22} />}
                    <span className={styles.noticeTitle}>{file ? file.name : t("dropTitle")}</span>
                    <span className={styles.hint}>
                        {file
                            ? t("fileSize", { mb: (file.size / 1024 ** 2).toFixed(1) })
                            : coverage
                              ? t("dropHint", { min: COVERAGE_PAGE_BOUNDS.min, max: COVERAGE_PAGE_BOUNDS.max, mb: maxMb })
                              : bounds
                                ? t("dropHintPages", { min: bounds.min, max: bounds.max, mb: maxMb })
                                : t("dropHintAny", { mb: maxMb })}
                    </span>
                </div>
            )}

            {current === "details" && (
                <>
                    <div className={styles.field}>
                        <label className={form.label}>{t("titleLabel")}</label>
                        <input
                            className={styles.input}
                            value={title}
                            maxLength={TITLE_MAX_LENGTH}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <label className={form.label}>{t("loglineLabel")}</label>
                            <span className={styles.hint}>
                                {t("loglineHint", { count: logline.trim().length, min: LOGLINE_MIN_LENGTH, max: LOGLINE_MAX_LENGTH })}
                            </span>
                        </div>
                        <textarea
                            className={styles.textarea}
                            style={{ minHeight: 100 }}
                            value={logline}
                            maxLength={LOGLINE_MAX_LENGTH}
                            onChange={(e) => setLogline(e.target.value)}
                            placeholder={t("loglinePlaceholder")}
                        />
                    </div>
                </>
            )}

            {current === "genres" && (
                <div className={styles.field}>
                    <label className={form.label}>{t("genresLabel", { max: GENRES_MAX })}</label>
                    <div className={styles.row} style={{ gap: 6 }}>
                        {Object.values(CommunityGenre).map((g) => (
                            <Chip key={g} on={genres.includes(g)} onClick={() => toggleGenre(g)}>
                                {tEnum(`genres.${g}`)}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.actions}>
                <div className={`${styles.row} ${styles.rowEnd} ${styles.actionRow}`}>
                    {(step > 0 || onBack) && (
                        <div className={styles.actionBack}>
                            <BackButton onClick={onStepBack} />
                        </div>
                    )}
                    {onCancel && (
                        <button type="button" className={`${styles.btn} ${styles.btnQuiet}`} onClick={onCancel} disabled={busy !== "idle"}>
                            {t("cancel")}
                        </button>
                    )}
                    {!last ? (
                        <button type="button" className={`${styles.btn} ${styles.btnWide}`} onClick={onNext}>
                            {t("next")}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnWide}`}
                            onClick={onSubmit}
                            disabled={busy !== "idle" || !canAfford}
                        >
                            {busy === "rendering" ? (
                                t("rendering")
                            ) : busy === "uploading" ? (
                                t("uploading")
                            ) : (
                                <>
                                    {t("submit")}
                                    {cost > 0 && (
                                        <span className={styles.btnCost}>
                                            <Ticket size={15} />
                                            {cost}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    )}
                </div>
                {error && <span className={`${styles.error} ${styles.actionError}`}>{error}</span>}
            </div>
        </div>
    );
};

/** A toggle in the format and genre pickers. */
export const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
    <button
        type="button"
        className={`${styles.btn} ${on ? "" : styles.btnOutline}`}
        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
        onClick={onClick}
        aria-pressed={on}
    >
        {children}
    </button>
);

export default SubmitForm;
