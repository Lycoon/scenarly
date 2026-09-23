"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CommunityShowcaseKind } from "@src/generated/client/browser";
import { SHOWCASE_KINDS, showcaseHref, type ShowcaseQuery } from "@src/lib/community/showcase";
import { join } from "@src/lib/utils/misc";

import community from "./Community.module.css";

/** All, Full script, Pilot, Short, Logline. Changing the kind goes back to page 1. */
const KindFilter = ({ query }: { query: ShowcaseQuery }) => {
    const t = useTranslations("community.showcase");
    const tEnum = useTranslations("community.enums");

    const chip = (kind: CommunityShowcaseKind | null, label: string) => {
        const on = query.kind === kind;
        return (
            <Link
                key={kind ?? "all"}
                href={showcaseHref({ sort: query.sort, kind })}
                className={join(community.btn, on ? "" : community.btnOutline)}
                aria-current={on ? "page" : undefined}
            >
                {label}
            </Link>
        );
    };

    return (
        <nav className={community.row} aria-label={t("kindLabel")}>
            {chip(null, t("kindAll"))}
            {SHOWCASE_KINDS.map((kind) => chip(kind, tEnum(`showcaseKinds.${kind}`)))}
        </nav>
    );
};

export default KindFilter;
