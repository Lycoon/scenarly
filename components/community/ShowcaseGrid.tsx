"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { useShowcaseVotes } from "@src/lib/community/hooks";
import { showcaseHref, type ShowcaseQuery, type ShowcaseSort } from "@src/lib/community/showcase";
import type { ShowcasePageView } from "@src/lib/community/types";
import { join } from "@src/lib/utils/misc";

import community from "./Community.module.css";
import styles from "./ShowcaseGrid.module.css";
import KindFilter from "./KindFilter";
import ShowcaseCard from "./ShowcaseCard";

interface ShowcaseGridProps {
    query: ShowcaseQuery;
    wall: ShowcasePageView;
}

/**
 * `/community/showcase`: Top / Newest, the kind chips, 24 cards a page. The
 * page is rendered on the server; each viewer's own votes, and counts fresher
 * than the cached page, arrive through `useShowcaseVotes`.
 */
const ShowcaseGrid = ({ query, wall }: ShowcaseGridProps) => {
    const t = useTranslations("community.showcase");
    const { votes, toggle } = useShowcaseVotes(wall.entries.map((e) => e.submissionId));

    const sortLink = (sort: ShowcaseSort, label: string) => {
        const on = query.sort === sort;
        return (
            <Link
                href={showcaseHref({ sort, kind: query.kind })}
                className={join(community.btn, on ? "" : community.btnOutline)}
                aria-current={on ? "page" : undefined}
            >
                {label}
            </Link>
        );
    };

    return (
        <div className={community.page}>
            <div className={community.pageInner}>
                <div className={community.section}>
                    <div className={join(community.row, community.tabRow, styles.controls)}>
                        <nav className={community.row} aria-label={t("sortLabel")}>
                            {sortLink("top", t("sortTop"))}
                            {sortLink("new", t("sortNew"))}
                        </nav>
                        <KindFilter query={query} />
                    </div>

                    {wall.entries.length === 0 ? (
                        <div className={community.notice}>
                            <span className={community.noticeTitle}>{t("emptyTitle")}</span>
                            <p className={community.muted}>{t("emptyBody")}</p>
                            <Link href="/community/coverage" className={community.btn}>
                                {t("emptyCta")}
                            </Link>
                        </div>
                    ) : (
                        <div className={join(community.grid, styles.wall)}>
                            {wall.entries.map((entry) => {
                                const vote = votes?.[entry.submissionId];
                                return (
                                    <ShowcaseCard
                                        key={entry.submissionId}
                                        entry={entry}
                                        count={vote?.upvoteCount ?? entry.upvoteCount}
                                        upvoted={vote?.upvoted ?? false}
                                        onToggle={(on) => toggle(entry.submissionId, on, entry.upvoteCount)}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {wall.pageCount > 1 && (
                        <nav className={styles.pager} aria-label={t("pageOf", { page: wall.page, count: wall.pageCount })}>
                            <PagerLink query={query} page={wall.page - 1} hidden={wall.page <= 1}>
                                <ArrowLeft size={14} /> {t("previous")}
                            </PagerLink>
                            <span>{t("pageOf", { page: wall.page, count: wall.pageCount })}</span>
                            <PagerLink query={query} page={wall.page + 1} hidden={wall.page >= wall.pageCount}>
                                {t("next")} <ArrowRight size={14} />
                            </PagerLink>
                        </nav>
                    )}
                </div>
            </div>
        </div>
    );
};

const PagerLink = ({ query, page, hidden, children }: { query: ShowcaseQuery; page: number; hidden: boolean; children: React.ReactNode }) =>
    hidden ? (
        <span className={join(community.btn, community.btnOutline, styles.pagerGap)} aria-hidden>
            {children}
        </span>
    ) : (
        <Link href={showcaseHref({ ...query, page })} className={join(community.btn, community.btnOutline, styles.pagerLink)}>
            {children}
        </Link>
    );

export default ShowcaseGrid;
