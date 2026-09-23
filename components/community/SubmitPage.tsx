"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, Ticket } from "lucide-react";

import { SUBMISSION_COST } from "@src/lib/community/constants";
import { useCommunityMe } from "@src/lib/community/hooks";

import styles from "./Community.module.css";
import { formatDate } from "./format";
import SubmitForm, { SubmitDestination } from "./SubmitForm";

/**
 * `/community/submit`: pick where the script goes, then upload it. Showcase
 * takes any format for free; Coverage takes features only and costs tickets.
 * The Scenarly-project path lives in the editor's Export tab. An account too
 * recent for Coverage sees that option greyed out, with the date it opens.
 */
const SubmitPage = () => {
    const t = useTranslations("community.submit");
    const tNav = useTranslations("community.nav");
    const router = useRouter();
    // `?to=` gives each step its own URL, so Back returns to the choice.
    const to = useSearchParams()?.get("to");
    const { me } = useCommunityMe();
    const tooRecent = me?.eligibility.reason === "TOO_RECENT";
    // A `?to=coverage` link the account can't use yet lands on the choice instead.
    const destination: SubmitDestination | null =
        to === "showcase" ? "SHOWCASE_ONLY" : to === "coverage" && !tooRecent ? "COVERAGE" : null;

    if (!destination) {
        return (
            <div className={styles.page}>
                <div className={`${styles.pageInner} ${styles.pageInnerNarrow}`}>
                    <h1 className={styles.pageTitle}>{t("title")}</h1>
                    <div className={styles.optionList}>
                        <Option
                            href="/community/submit?to=showcase"
                            title={tNav("showcase")}
                            points={[t("showcaseOptionPoint1"), t("showcaseOptionPoint2")]}
                            formats={t("showcaseOptionFormats")}
                            cost={t("unlimited")}
                        />
                        <Option
                            href="/community/submit?to=coverage"
                            title={tNav("coverage")}
                            points={[t("coverageOptionPoint1"), t("coverageOptionPoint2")]}
                            formats={t("coverageOptionFormats")}
                            cost={SUBMISSION_COST}
                            disabledNote={tooRecent ? t("coverageTooRecent", { date: formatDate(me?.eligibility.eligibleAt) }) : undefined}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={`${styles.pageInner} ${styles.pageInnerForm}`}>
                <h1 className={styles.pageTitle}>{destination === "COVERAGE" ? t("titleCoverage") : t("titleShowcase")}</h1>
                <SubmitForm
                    key={destination}
                    source={{ kind: "upload" }}
                    destination={destination}
                    onSubmitted={(id) => router.push(`/community/submissions/${id}`)}
                    onBack={() => router.push("/community/submit")}
                />
            </div>
        </div>
    );
};

/**
 * One destination on the choice step: what it is, what it takes, what it
 * costs — tickets, or a quiet note when it costs nothing. With a
 * `disabledNote`, it is greyed out and says why instead of linking.
 */
const Option = ({
    href,
    title,
    points,
    formats,
    cost,
    disabledNote,
}: {
    href: string;
    title: string;
    points: string[];
    formats: string;
    cost: number | string;
    disabledNote?: string;
}) => {
    const body = (
        <>
            <div className={styles.labelRow}>
                <span className={styles.cardTitle}>{title}</span>
                {typeof cost === "number" ? (
                    <span className={styles.btnCost}>
                        <Ticket size={15} />
                        {cost}
                    </span>
                ) : (
                    <span className={styles.hint}>{cost}</span>
                )}
            </div>
            <ul className={`${styles.muted} ${styles.optionPoints}`}>
                {points.map((p) => (
                    <li key={p}>{p}</li>
                ))}
            </ul>
            <span className={styles.optionFormats}>
                <FileText size={14} />
                {formats}
            </span>
        </>
    );

    if (disabledNote) {
        return (
            <div className={styles.optionDisabled} aria-disabled>
                <div className={`${styles.option} ${styles.dimmed}`}>{body}</div>
                <span className={styles.hint}>{disabledNote}</span>
            </div>
        );
    }
    return (
        <Link href={href} className={styles.option}>
            {body}
        </Link>
    );
};

export default SubmitPage;
