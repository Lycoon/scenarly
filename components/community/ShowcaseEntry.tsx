"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeft, PenLine } from "lucide-react";

import { useShowcaseVotes } from "@src/lib/community/hooks";
import { getShowcasePdfUrl } from "@src/lib/community/requests";
import { showsPdf } from "@src/lib/community/showcase";
import type { ShowcaseEntryView } from "@src/lib/community/types";
import { join } from "@src/lib/utils/misc";

import community from "./Community.module.css";
import styles from "./ShowcaseEntry.module.css";
import PdfViewer from "./PdfViewer";
import UpvoteButton from "./UpvoteButton";

/**
 * `/community/showcase/[slug]`: what the entry is, its upvote, and the script
 * itself — the PDF, or for a LOGLINE entry the logline, which is all there is.
 * Signed out, the PDF still reads; only the vote asks for a session. A script
 * exported from the editor says so, linking to the homepage: the one mention of
 * the app a reader who is not a user gets, and only where it is true.
 */
const ShowcaseEntry = ({ entry }: { entry: ShowcaseEntryView }) => {
    const t = useTranslations("community.showcase");
    const tEnum = useTranslations("community.enums");
    const format = useFormatter();
    const { votes, toggle } = useShowcaseVotes([entry.submissionId]);
    const vote = votes?.[entry.submissionId];
    const pdf = showsPdf(entry.kind);

    return (
        <div className={community.page}>
            <div className={community.pageInner}>
                <Link href="/community/showcase" className={community.backLink}>
                    <ArrowLeft size={14} /> {t("backToWall")}
                </Link>

                <div className={community.pageHeader}>
                    <div className={community.section} style={{ gap: 6 }}>
                        <h1 className={community.pageTitle}>{entry.title}</h1>
                        <div className={community.cardMeta}>
                            <span className={community.tag}>{tEnum(`showcaseKinds.${entry.kind}`)}</span>
                            {entry.genres.map((g) => (
                                <span key={g} className={community.tag}>
                                    {tEnum(`genres.${g}`)}
                                </span>
                            ))}
                            {pdf && <span>{t("pages", { count: entry.pageCount })}</span>}
                            {/* In English and UTC on the server and the client alike (see ShowcaseIntl). */}
                            {entry.fromScenarly && (
                                // The app's `/` hands off to the landing site (HomeClient).
                                <Link href="/" className={join(community.tag, styles.madeWith)}>
                                    <PenLine size={11} /> {t("writtenWith")}
                                </Link>
                            )}
                            <span>{t("publishedOn", { date: format.dateTime(new Date(entry.publishedAt), { dateStyle: "medium" }) })}</span>
                        </div>
                    </div>
                    <UpvoteButton
                        size="large"
                        count={vote?.upvoteCount ?? entry.upvoteCount}
                        upvoted={vote?.upvoted ?? false}
                        onToggle={(on) => toggle(entry.submissionId, on, entry.upvoteCount)}
                    />
                </div>

                {pdf ? (
                    <>
                        <p className={community.pageSubtitle}>{entry.logline}</p>
                        <PdfViewer getUrl={() => getShowcasePdfUrl(entry.slug)} />
                    </>
                ) : (
                    <div className={community.card}>
                        <p style={{ fontSize: "1.05rem", lineHeight: 1.6, whiteSpace: "pre-line" }}>{entry.logline}</p>
                        <span className={community.hint}>{t("loglineOnly")}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShowcaseEntry;
