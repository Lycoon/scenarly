"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import Dropdown from "@components/utils/Dropdown";
import type { CommunityShowcaseKind } from "@src/generated/client/browser";
import { SHOWCASE_KINDS, showcaseHref, type ShowcaseQuery } from "@src/lib/community/showcase";

import styles from "./ShowcaseGrid.module.css";

const ALL = "all";

/** All, Full script, Pilot, Short, as a dropdown. Changing the kind goes back to page 1. */
const KindFilter = ({ query }: { query: ShowcaseQuery }) => {
    const t = useTranslations("community.showcase");
    const tEnum = useTranslations("community.enums");
    const router = useRouter();

    const options = [
        { value: ALL, label: t("kindAll") },
        ...SHOWCASE_KINDS.map((kind) => ({ value: kind, label: tEnum(`showcaseKinds.${kind}`) })),
    ];

    return (
        <div className={styles.kindFilter} role="group" aria-label={t("kindLabel")}>
            <Dropdown
                value={query.kind ?? ALL}
                onChange={(v) => router.push(showcaseHref({ sort: query.sort, kind: v === ALL ? null : (v as CommunityShowcaseKind) }))}
                options={options}
                className={styles.kindTrigger}
                menuClassName={styles.kindMenu}
                fitContent
            />
        </div>
    );
};

export default KindFilter;
