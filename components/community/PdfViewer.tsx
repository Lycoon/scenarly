"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import Loading from "@components/utils/Loading";
import type { PresignedPdf } from "@src/lib/community/types";

import styles from "./PdfViewer.module.css";

interface PdfViewerProps {
    /** Asks the API for a fresh short-lived URL; called again when one lapses. */
    getUrl: () => Promise<PresignedPdf>;
}

/** Widest a page gets at 100%: about a Letter page at actual size, past which a script reads as zoomed in. */
const FIT_MAX_WIDTH = 760;
const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

/**
 * Inline, read-only PDF viewer: `pdfjs-dist` draws pages onto canvases as they
 * scroll near the viewport and drops them once far away. The toolbar only
 * zooms and goes full screen — no download or print control, no text layer,
 * right-click disabled — the file is meant to be read here and nowhere else.
 * The reviewer's copy carries the watermark in the bytes, so this is not the
 * protection, only the default.
 */
const PdfViewer = ({ getUrl }: PdfViewerProps) => {
    const t = useTranslations("community.viewer");
    const rootRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pagesRef = useRef<HTMLDivElement>(null);
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    // Every page is sized from the first one until drawn: scripts are uniform.
    const [aspect, setAspect] = useState(11 / 8.5);
    const [available, setAvailable] = useState(0);
    // Space between pages, read from the stylesheet (it shrinks on phones).
    const [gap, setGap] = useState(0);
    const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
    const [current, setCurrent] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [canFullscreen, setCanFullscreen] = useState(false);
    // Where the reader was, as a fraction of the scroll height, kept across a zoom.
    const anchor = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        let loaded: PDFDocumentProxy | null = null;
        (async () => {
            try {
                // Legacy build: the modern one calls Math.sumPrecise and
                // Map#getOrInsertComputed unpolyfilled (the worker's TrueType
                // rebuild among them), and engines without those draw blank pages.
                const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
                pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
                    import.meta.url,
                ).toString();
                const { url } = await getUrl();
                loaded = await pdfjs.getDocument({ url, disableAutoFetch: true, disableStream: false }).promise;
                if (cancelled) return loaded.loadingTask.destroy();
                const first = (await loaded.getPage(1)).getViewport({ scale: 1 });
                if (cancelled) return;
                setAspect(first.height / first.width);
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

    // The column's usable width, tracked so pages refit on resize and full screen.
    useEffect(() => {
        const el = scrollRef.current;
        const pages = pagesRef.current;
        if (!el || !pages) return;
        const measure = () => {
            const style = getComputedStyle(pages);
            const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            setAvailable(Math.max(0, el.clientWidth - padding));
            setGap(parseFloat(style.rowGap) || 0);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [doc]);

    useEffect(() => {
        setCanFullscreen(!!document.fullscreenEnabled);
        const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const zoom = ZOOM_STEPS[zoomIndex];
    const width = Math.round(Math.min(available, FIT_MAX_WIDTH) * zoom);
    const pageHeight = width * aspect;

    // Keep the same spot of the script under the reader's eyes across a zoom.
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || anchor.current === null) return;
        el.scrollTop = anchor.current * el.scrollHeight - el.clientHeight / 2;
        anchor.current = null;
    }, [width]);

    const setZoom = (index: number) => {
        const next = Math.max(0, Math.min(ZOOM_STEPS.length - 1, index));
        // No width change means no layout effect to consume the anchor; a stale
        // one would yank the scroll on the next resize.
        if (next === zoomIndex) return;
        const el = scrollRef.current;
        if (el) anchor.current = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight;
        setZoomIndex(next);
    };

    // WebKit keeps the scrollbar's old place for hit testing after the page
    // around the viewer scrolls, so grabbing the thumb lands on the track and
    // jumps. Recreating the scrollbar once the page settles refreshes it; set
    // and restored before any paint, so nothing flickers.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => {
            el.style.overflow = "hidden";
            void el.offsetHeight;
            el.style.overflow = "";
        };
        const onScroll = (e: Event) => {
            const target = e.target === document ? document.documentElement : (e.target as Element);
            if (target === el || !target.contains(el)) return;
            clearTimeout(timer);
            timer = setTimeout(refresh, 100);
        };
        document.addEventListener("scroll", onScroll, { capture: true, passive: true });
        return () => {
            clearTimeout(timer);
            document.removeEventListener("scroll", onScroll, { capture: true });
        };
    }, [doc]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el || !doc || pageHeight <= 0) return;
        const page = Math.floor((el.scrollTop + el.clientHeight / 3) / (pageHeight + gap)) + 1;
        setCurrent(Math.max(1, Math.min(doc.numPages, page)));
    };

    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else rootRef.current?.requestFullscreen();
    };

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
        <div ref={rootRef} className={styles.viewer}>
            <div className={styles.toolbar}>
                <span className={styles.counter}>
                    {current} / {doc.numPages}
                </span>
                <div className={styles.controls}>
                    <button
                        className={styles.tool}
                        onClick={() => setZoom(zoomIndex - 1)}
                        disabled={zoomIndex === 0}
                        title={t("zoomOut")}
                        aria-label={t("zoomOut")}
                    >
                        <ZoomOut size={16} />
                    </button>
                    <button className={styles.zoomLevel} onClick={() => setZoom(ZOOM_STEPS.indexOf(1))} title={t("resetZoom")}>
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        className={styles.tool}
                        onClick={() => setZoom(zoomIndex + 1)}
                        disabled={zoomIndex === ZOOM_STEPS.length - 1}
                        title={t("zoomIn")}
                        aria-label={t("zoomIn")}
                    >
                        <ZoomIn size={16} />
                    </button>
                    {canFullscreen && (
                        <button
                            className={styles.tool}
                            onClick={toggleFullscreen}
                            title={fullscreen ? t("exitFullscreen") : t("fullscreen")}
                            aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
                        >
                            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    )}
                </div>
            </div>
            <div ref={scrollRef} className={styles.scroll} onScroll={onScroll} onContextMenu={(e) => e.preventDefault()}>
                <div ref={pagesRef} className={styles.pages}>
                    {width > 0 &&
                        Array.from({ length: doc.numPages }, (_, i) => (
                            <Page
                                key={i + 1}
                                doc={doc}
                                pageNumber={i + 1}
                                width={width}
                                height={pageHeight}
                                root={scrollRef}
                                onLapsed={onLapsed}
                            />
                        ))}
                </div>
            </div>
        </div>
    );
};

interface PageProps {
    doc: PDFDocumentProxy;
    pageNumber: number;
    /** CSS width to draw at; the height follows the first page's aspect. */
    width: number;
    height: number;
    root: React.RefObject<HTMLDivElement | null>;
    onLapsed: () => void;
}

/** One page: a blank sheet of the right size until it nears the viewport, then a canvas, dropped again once far away. */
const Page = ({ doc, pageNumber, width, height, root, onLapsed }: PageProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [visible, setVisible] = useState(pageNumber <= 2);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const observer = new IntersectionObserver((entries) => setVisible(entries[entries.length - 1].isIntersecting), {
            root: root.current,
            rootMargin: "1200px 0px",
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [root]);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        let task: RenderTask | null = null;
        // Let a zoom settle before redrawing; the old bitmap stretches meanwhile.
        const timer = setTimeout(async () => {
            try {
                const page = await doc.getPage(pageNumber);
                const canvas = canvasRef.current;
                if (!canvas || cancelled) return;
                const base = page.getViewport({ scale: 1 });
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const viewport = page.getViewport({ scale: (width / base.width) * dpr });
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                task = page.render({ canvasContext: ctx, viewport, canvas });
                await task.promise;
            } catch (e) {
                // A lapsed presigned URL surfaces as a fetch error on a page not yet
                // fetched; ask for a fresh document.
                if (!cancelled && String(e).includes("Unexpected server response")) onLapsed();
            }
        }, 80);
        return () => {
            cancelled = true;
            clearTimeout(timer);
            task?.cancel();
        };
    }, [visible, doc, pageNumber, width, onLapsed]);

    return (
        <div ref={wrapRef} className={styles.page} style={{ width, height }}>
            {visible && <canvas ref={canvasRef} className={styles.canvas} />}
        </div>
    );
};

export default PdfViewer;
