"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Shuffle } from "lucide-react";

import Loading from "@components/utils/Loading";
import { useActiveClaim, useCommunityMe, useOffers } from "@src/lib/community/hooks";
import { claimSubmission, getClaimPdfUrl, isApiError, reshuffleOffers } from "@src/lib/community/requests";
import { OFFER_SIZE } from "@src/lib/community/constants";

import styles from "./Community.module.css";
import OfferCard from "./OfferCard";
import PdfViewer from "./PdfViewer";
import ReviewForm from "./ReviewForm";
import { daysUntil, formatDate } from "./format";

/**
 * `/community/coverage/review`: the offer set while no claim is active, the
 * claim workspace (script on the left, form on the right) while one is.
 */
const ReviewPage = () => {
    const t = useTranslations("community.offers");
    const tClaim = useTranslations("community.claim");
    const tEnum = useTranslations("community.enums");
    const { mutate: mutateMe } = useCommunityMe();
    const { claim, isLoading: loadingClaim, mutate: mutateClaim } = useActiveClaim();
    const { offers, isLoading: loadingOffers, mutate: mutateOffers } = useOffers(!loadingClaim && !claim);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ended, setEnded] = useState<"submitted" | "released" | "gone" | null>(null);

    const refresh = useCallback(async () => {
        await Promise.all([mutateClaim(), mutateMe()]);
        await mutateOffers();
    }, [mutateClaim, mutateMe, mutateOffers]);

    const onClaim = async (submissionId: string) => {
        setBusy(true);
        setError(null);
        try {
            await claimSubmission(submissionId);
            setEnded(null);
            await refresh();
        } catch (e) {
            setError(isApiError(e) ? e.message : t("claimFailed"));
            if (isApiError(e) && e.code === "NOT_OFFERED") await mutateOffers();
        } finally {
            setBusy(false);
        }
    };

    const onReshuffle = async () => {
        setBusy(true);
        setError(null);
        try {
            const next = await reshuffleOffers();
            await mutateOffers(next, { revalidate: false });
        } catch (e) {
            setError(isApiError(e) ? e.message : t("reshuffleFailed"));
        } finally {
            setBusy(false);
        }
    };

    const onEnded = useCallback(
        async (how: "submitted" | "released" | "gone") => {
            setEnded(how);
            await refresh();
        },
        [refresh],
    );

    if (loadingClaim || (!claim && loadingOffers)) {
        return (
            <div className={styles.page}>
                <Loading />
            </div>
        );
    }

    if (claim) {
        const getUrl = () => getClaimPdfUrl(claim.id);
        return (
            <div className={styles.page}>
                <div className={styles.pageInner}>
                    <div className={styles.pageHeader}>
                        <div className={styles.section} style={{ gap: 6 }}>
                            <h1 className={styles.pageTitle}>{claim.submission.title}</h1>
                            <div className={styles.cardMeta}>
                                <span className={styles.tag}>{tEnum(`formats.${claim.submission.format}`)}</span>
                                {claim.submission.genres.map((g) => (
                                    <span key={g} className={styles.tag}>
                                        {tEnum(`genres.${g}`)}
                                    </span>
                                ))}
                                <span>{t("pages", { count: claim.submission.pageCount })}</span>
                            </div>
                        </div>
                        <div className={styles.section} style={{ gap: 2, alignItems: "flex-end" }}>
                            <span className={styles.muted}>
                                {claim.canSubmit ? tClaim("canSubmitNow") : tClaim("canSubmitFrom", { date: formatDate(claim.floorAt) })}
                            </span>
                            <span className={styles.muted}>
                                {tClaim("deadlineOn", { date: formatDate(claim.deadlineAt), days: Math.max(0, daysUntil(claim.deadlineAt)) })}
                            </span>
                        </div>
                    </div>
                    <p className={styles.pageSubtitle}>{claim.submission.logline}</p>
                    <div className={styles.splitPane}>
                        <PdfViewer getUrl={getUrl} />
                        <ReviewForm claim={claim} onEnded={onEnded} />
                    </div>
                </div>
            </div>
        );
    }

    const canReshuffleAt = offers ? new Date(offers.canReshuffleAt) : null;
    const canReshuffle = !!canReshuffleAt && canReshuffleAt.getTime() <= Date.now();
    const thinPool = !!offers && offers.items.length < OFFER_SIZE;

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                {ended && (
                    <div className={`${styles.banner} ${ended === "submitted" ? styles.bannerSuccess : ""}`}>
                        <span>
                            {ended === "submitted"
                                ? tClaim("submittedBanner")
                                : ended === "released"
                                  ? tClaim("releasedBanner")
                                  : tClaim("goneBanner")}
                        </span>
                        <button className={`${styles.btn} ${styles.btnQuiet}`} onClick={() => setEnded(null)}>
                            ×
                        </button>
                    </div>
                )}
                <div className={styles.pageHeader}>
                    <div className={styles.section} style={{ gap: 6 }}>
                        <h1 className={styles.pageTitle}>{t("title")}</h1>
                        <p className={styles.pageSubtitle}>{t("subtitle")}</p>
                    </div>
                    {!thinPool && (
                        <button
                            className={`${styles.btn} ${styles.btnOutline}`}
                            onClick={onReshuffle}
                            disabled={busy || !canReshuffle}
                            title={!canReshuffle && canReshuffleAt ? t("reshuffleAt", { time: formatDate(canReshuffleAt, true) }) : undefined}
                        >
                            <Shuffle size={16} />
                            {canReshuffle ? t("reshuffle") : t("reshuffleAt", { time: formatDate(canReshuffleAt, true) })}
                        </button>
                    )}
                </div>

                {error && <span className={styles.error}>{error}</span>}

                {offers && offers.items.length > 0 ? (
                    <div className={styles.grid}>
                        {offers.items.map((item) => (
                            <OfferCard key={item.id} item={item} busy={busy} onClaim={onClaim} />
                        ))}
                    </div>
                ) : (
                    <div className={styles.notice}>
                        <span className={styles.noticeTitle}>{t("emptyTitle")}</span>
                        <p className={styles.muted}>{t("emptyBody")}</p>
                    </div>
                )}
                {thinPool && offers.items.length > 0 && <p className={styles.hint}>{t("thinPool")}</p>}
            </div>
        </div>
    );
};

export default ReviewPage;
