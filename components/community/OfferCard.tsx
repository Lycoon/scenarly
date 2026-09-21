"use client";

import { useTranslations } from "next-intl";
import { FileText, MessageSquare } from "lucide-react";

import type { OfferItem } from "@src/lib/community/types";

import styles from "./Community.module.css";

interface OfferCardProps {
    item: OfferItem;
    busy: boolean;
    onClaim: (submissionId: string) => void;
}

/** One offered script: everything a reviewer may know before claiming, and nothing about who wrote it. */
const OfferCard = ({ item, busy, onClaim }: OfferCardProps) => {
    const t = useTranslations("community.offers");
    const tEnum = useTranslations("community.enums");

    return (
        <div className={styles.card} style={{ opacity: item.available ? 1 : 0.5 }}>
            <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <span className={styles.cardTitle} style={{ textDecoration: item.available ? "none" : "line-through" }}>
                    {item.title}
                </span>
                <span className={styles.tag}>{tEnum(`formats.${item.format}`)}</span>
            </div>
            <p className={styles.muted} style={{ flex: 1 }}>
                {item.logline}
            </p>
            <div className={styles.row} style={{ gap: 6 }}>
                {item.genres.map((g) => (
                    <span key={g} className={styles.tag}>
                        {tEnum(`genres.${g}`)}
                    </span>
                ))}
            </div>
            <div className={styles.cardMeta}>
                <span>
                    <FileText size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {t("pages", { count: item.pageCount })}
                </span>
                <span>
                    <MessageSquare size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {t("reviewsSoFar", { count: item.completedReviewCount })}
                </span>
            </div>
            <button className={styles.btn} disabled={busy || !item.available} onClick={() => onClaim(item.id)}>
                {item.available ? t("claim") : t("unavailable")}
            </button>
        </div>
    );
};

export default OfferCard;
