"use client";

import { ReactNode, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Ticket, Upload } from "lucide-react";
import { useSWRConfig } from "swr";

import BackButton from "@components/utils/BackButton";
import { CommunityFormat, CommunityGenre } from "@src/generated/client/browser";
import { createSubmission, isApiError } from "@src/lib/community/requests";
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

/** Where the PDF comes from: a file the user picks, or the open project's export. */
export type SubmitSource =
    | { kind: "upload" }
    | { kind: "project"; projectId: string; buildPdf: () => Promise<Blob> };

/** Coverage: feature only, costs tickets, gets reviewed. Showcase only: any format, free. */
export type SubmitDestination = "COVERAGE" | "SHOWCASE_ONLY";

interface SubmitFormProps {
    source: SubmitSource;
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
 * fixed; a Showcase-only submission picks its format, which sets the bounds,
 * and costs nothing. Field rules mirror the API's zod schema through the
 * shared constants.
 */
const SubmitForm = ({
    source,
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
    const [format, setFormat] = useState<CommunityFormat | null>(null);
    const [busy, setBusy] = useState<"idle" | "rendering" | "uploading">("idle");
    const [error, setError] = useState<string | null>(null);

    const coverage = destination === "COVERAGE";
    const cost = coverage ? SUBMISSION_COST : 0;
    const balance = me?.balance ?? 0;
    const canAfford = balance >= cost;
    const bounds = coverage ? COVERAGE_PAGE_BOUNDS : format ? PAGE_BOUNDS[format] : null;
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

    const validate = (): string | null => {
        if (!coverage && !format) return t("errors.noFormat");
        if (source.kind === "upload" && !file) return t("errors.noFile");
        if (!title.trim()) return t("errors.noTitle");
        if (logline.trim().length < LOGLINE_MIN_LENGTH) return t("errors.loglineShort", { min: LOGLINE_MIN_LENGTH });
        if (genres.length === 0) return t("errors.noGenre");
        if (!canAfford) return t("errors.tickets", { cost, balance });
        return null;
    };

    const onSubmit = async () => {
        const problem = validate();
        if (problem) return setError(problem);
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
            const created = await createSubmission(blob, {
                title: title.trim(),
                logline: logline.trim(),
                genres,
                format: format ?? undefined,
                sourceProjectId: source.kind === "project" ? source.projectId : undefined,
                destination,
            });
            await Promise.all([mutateMe(), mutate("/api/community/submissions")]);
            onSubmitted(created.id);
        } catch (e) {
            if (isApiError(e) && e.code === "DUPLICATE_PDF") setError(t("errors.duplicate"));
            else if (isApiError(e) && e.code === "INSUFFICIENT_TICKETS") setError(t("errors.tickets", { cost, balance }));
            else if (isApiError(e)) setError(e.message);
            else setError(t("errors.failed"));
        } finally {
            setBusy("idle");
        }
    };

    return (
        <div className={styles.section} style={{ gap: 18 }}>
            {!coverage && (
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

            {source.kind === "upload" && (
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

            <div className={styles.actions}>
                <div className={`${styles.row} ${styles.rowEnd} ${styles.actionRow}`}>
                    {onBack && (
                        <div className={styles.actionBack}>
                            <BackButton onClick={onBack} />
                        </div>
                    )}
                    {onCancel && (
                        <button type="button" className={`${styles.btn} ${styles.btnQuiet}`} onClick={onCancel} disabled={busy !== "idle"}>
                            {t("cancel")}
                        </button>
                    )}
                    <button type="button" className={`${styles.btn} ${styles.btnWide}`} onClick={onSubmit} disabled={busy !== "idle" || !canAfford}>
                        {busy === "rendering" ? (
                            t("rendering")
                        ) : busy === "uploading" ? (
                            t("uploading")
                        ) : (
                            <>
                                {t("submit")}
                                <span className={styles.btnCost}>
                                    <Ticket size={15} />
                                    {cost}
                                </span>
                            </>
                        )}
                    </button>
                </div>
                {error && <span className={`${styles.error} ${styles.actionError}`}>{error}</span>}
            </div>
        </div>
    );
};

/** A toggle in the format and genre pickers. */
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
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
