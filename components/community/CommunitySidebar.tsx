"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Coins, FolderOpen, Home, PenLine, Upload, Users } from "lucide-react";

import LibrarySidebar from "@components/projects/LibrarySidebar";
import { useCommunityMe } from "@src/lib/community/hooks";
import { join } from "@src/lib/utils/misc";

import page from "@components/projects/ProjectPageContainer.module.css";
import styles from "./CommunitySidebar.module.css";

interface CommunitySidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

/**
 * The library sidebar with Community's navigation in place of the project
 * actions: Showcase behind the home icon on the logo row, then the projects
 * and Coverage pills, then — for a member — the two things they can do in
 * Coverage, and their balance.
 */
const CommunitySidebar = ({ sidebarOpen, setSidebarOpen }: CommunitySidebarProps) => {
    const t = useTranslations("community.nav");
    const pathname = usePathname() ?? "";
    const { me } = useCommunityMe();
    const close = () => setSidebarOpen(false);

    const item = (href: string, icon: React.ReactNode, label: string, active: boolean, primary = false) => (
        <Link
            href={href}
            onClick={close}
            className={join(page.action_btn, styles.link, primary ? page.action_primary : "", active ? styles.active : "")}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );

    return (
        <LibrarySidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            title={t("community")}
            subtitle={t("community")}
            topRight={
                // Showcase is Community's home: the public wall everyone lands on.
                <Link
                    href="/community/showcase"
                    onClick={close}
                    className={join(page.sidebar_icon, pathname.startsWith("/community/showcase") ? page.sidebar_icon_active : "")}
                    aria-label={t("showcase")}
                    title={t("showcase")}
                >
                    <Home size={18} />
                </Link>
            }
        >
            {item("/projects", <FolderOpen size={16} />, t("backToApp"), false)}
            {item("/community/coverage", <Users size={16} />, t("coverage"), pathname === "/community/coverage", true)}
            {me?.profile && (
                <>
                    <div className={styles.divider} />
                    {item("/community/coverage/submit", <Upload size={16} />, t("submit"), pathname.startsWith("/community/coverage/submit"))}
                    {item("/community/coverage/review", <PenLine size={16} />, t("review"), pathname.startsWith("/community/coverage/review"))}
                    {/* Pinned to the bottom of the column: the sidebar is a flex
                        column and this is the only item that grows. */}
                    <div className={styles.credits} title={t("creditsTitle")}>
                        <Coins size={14} className={styles.creditsIcon} />
                        <span>{t("credits", { count: me.balance })}</span>
                    </div>
                </>
            )}
        </LibrarySidebar>
    );
};

export default CommunitySidebar;
