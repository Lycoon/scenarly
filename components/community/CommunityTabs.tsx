"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { join } from "@src/lib/utils/misc";

import styles from "./CommunityTabs.module.css";

/**
 * Community's two halves at the left of the navbar: Showcase — the public wall
 * `/community` lands on — and Coverage. This is the only place the section is
 * switched; the sidebar below carries what you can *do* inside the section.
 */
const CommunityTabs = () => {
    const t = useTranslations("community.nav");
    const pathname = usePathname() ?? "";
    // Everything that is not Coverage is the public side, so `/community` itself
    // lights the first tab while it redirects. Submitting and the member's
    // submissions (`/community/submit`, `/community/submissions`) belong to both
    // halves, so they light neither.
    const inCoverage = pathname.startsWith("/community/coverage");
    const inBoth = pathname.startsWith("/community/submit") || pathname.startsWith("/community/submissions");
    const inShowcase = !inCoverage && !inBoth;

    const tab = (href: string, label: string, active: boolean) => (
        <Link href={href} className={join(styles.tab, active ? styles.active : "")} aria-current={active ? "page" : undefined}>
            {label}
        </Link>
    );

    return (
        <div className={styles.tabs}>
            {tab("/community/showcase", t("showcase"), inShowcase)}
            {tab("/community/coverage", t("coverage"), inCoverage)}
        </div>
    );
};

export default CommunityTabs;
