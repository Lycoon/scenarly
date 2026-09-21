"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "pdfjs-dist";

import Loading from "@components/utils/Loading";
import type { PresignedPdf } from "@src/lib/community/types";

import styles from "./PdfViewer.module.css";

interface PdfViewerProps {
    /** Asks the API for a fresh short-lived URL; called again when one lapses. */
    getUrl: () => Promise<PresignedPdf>;
}

/**
 * Inline, read-only PDF viewer: `pdfjs-dist` draws pages onto canvases as they
 * scroll into view. No toolbar, no download or print control, no text layer,
 * right-click disabled — the file is meant to be read here and nowhere else.
 * The reviewer's copy carries the watermark in the bytes, so this is not the
 * protection, only the default.
 */
const PdfViewer = ({ getUrl }: PdfViewerProps) => {
    const t = useTranslations("community.viewer");
    const containerRef = useRef<HTMLDivElement>(null);
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        let loaded: PDFDocumentProxy | null = null;
        (async () => {
            try {
                const pdfjs = await import("pdfjs-dist");
                pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                    "pdfjs-dist/build/pdf.worker.min.mjs",
                    import.meta.url,
                ).toString();
                const { url } = await getUrl();
                loaded = await pdfjs.getDocument({ url, disableAutoFetch: true, disableStream: false }).promise;
                if (cancelled) return loaded.loadingTask.destroy();
                setDoc(loaded);
                setError(null);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : t("failed"));
            }
        })();
        return () => {
            cancelled = true;
            loaded?.loadingTask.destroy();
        };
        // `attempt` re-runs the load with a fresh URL after a lapse.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]);

    const onLapsed = useCallback(() => setAttempt((n) => n + 1), []);

    if (error) {
        return (
            <div className={styles.state}>
                <span>{t("failed")}</span>
                <button className={styles.retry} onClick={onLapsed}>
                    {t("retry")}
                </button>
            </div>
        );
    }
    if (!doc) {
        return (
            <div className={styles.state}>
                <Loading />
            </div>
        );
    }

    return (
        <div ref={containerRef} className={styles.container} onContextMenu={(e) => e.preventDefault()}>
            {Array.from({ length: doc.numPages }, (_, i) => (
                <Page key={i + 1} doc={doc} pageNumber={i + 1} root={containerRef} onLapsed={onLapsed} />
            ))}
        </div>
    );
};

interface PageProps {
    doc: PDFDocumentProxy;
    pageNumber: number;
    root: React.RefObject<HTMLDivElement | null>;
    onLapsed: () => void;
}

/** One page: a placeholder of the right aspect ratio until it scrolls near the viewport, then a canvas. */
const Page = ({ doc, pageNumber, root, onLapsed }: PageProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [visible, setVisible] = useState(pageNumber <= 2);
    const [aspect, setAspect] = useState(11 / 8.5);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el || visible) return;
        const observer = new IntersectionObserver(
            (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
            { root: root.current, rootMargin: "800px 0px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [visible, root]);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        (async () => {
            try {
                const page = await doc.getPage(pageNumber);
                const canvas = canvasRef.current;
                const wrap = wrapRef.current;
                if (!canvas || !wrap || cancelled) return;
                const base = page.getViewport({ scale: 1 });
                setAspect(base.height / base.width);
                const scale = wrap.clientWidth / base.width;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const viewport = page.getViewport({ scale: scale * dpr });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${wrap.clientWidth}px`;
                canvas.style.height = `${(viewport.height / viewport.width) * wrap.clientWidth}px`;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            } catch (e) {
                // A lapsed presigned URL surfaces as a fetch error on a page not yet
                // fetched; ask for a fresh document.
                if (!cancelled && String(e).includes("Unexpected server response")) onLapsed();
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [visible, doc, pageNumber, onLapsed]);

    return (
        <div ref={wrapRef} className={styles.page} style={{ aspectRatio: `1 / ${aspect}` }}>
            {visible && <canvas ref={canvasRef} className={styles.canvas} />}
        </div>
    );
};

export default PdfViewer;
