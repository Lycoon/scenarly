"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ShowcaseEntryView } from "@src/lib/community/types";
import { showsPdf } from "@src/lib/community/showcase";
import { join } from "@src/lib/utils/misc";

import community from "./Community.module.css";
import styles from "./ShowcaseCard.module.css";
import UpvoteButton from "./UpvoteButton";

interface ShowcaseCardProps {
    entry: ShowcaseEntryView;
    count: number;
    upvoted: boolean;
    onToggle: (on: boolean) => Promise<void>;
}

/**
 * One entry on the wall: title, one line of kind · genres · length, upvotes.
 * The logline stays folded to two lines, with room for two kept even when it
 * is shorter, so every card on the wall is the same size. A click anywhere but
 * the upvote button opens the entry, where the logline reads in full.
 */
const ShowcaseCard = ({ entry, count, upvoted, onToggle }: ShowcaseCardProps) => {
    const t = useTranslations("community.showcase");
    const tEnum = useTranslations("community.enums");

    const hasPdf = showsPdf(entry.kind);
    const meta = [
        tEnum(`showcaseKinds.${entry.kind}`),
        entry.genres.map((g) => tEnum(`genres.${g}`)).join(", "),
        hasPdf && t("pages", { count: entry.pageCount }),
    ].filter(Boolean);

    return (
        <article className={join(community.card, styles.card)}>
            <div className={styles.head}>
                <div className={styles.heading}>
                    <Link href={`/community/showcase/${entry.slug}`} className={join(community.cardTitle, styles.titleLink)}>
                        {entry.title}
                    </Link>
                    <span className={styles.meta}>{meta.join(" · ")}</span>
                </div>
                <span className={styles.raised}>
                    <UpvoteButton count={count} upvoted={upvoted} onToggle={onToggle} />
                </span>
            </div>

            <p className={styles.logline}>{entry.logline}</p>
        </article>
    );
};

export default ShowcaseCard;
