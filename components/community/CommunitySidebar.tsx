"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderOpen, PenLine, Ticket, Upload } from "lucide-react";

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
 * actions: the way back to the projects library, then — for a member — the two
 * things they can do in Coverage, and their balance. Switching between
 * Showcase and Coverage is the navbar's job (see [CommunityTabs]).
 */
const CommunitySidebar = ({ sidebarOpen, setSidebarOpen }: CommunitySidebarProps) => {
    const t = useTranslations("community.nav");
    const pathname = usePathname() ?? "";
    const { me } = useCommunityMe();
    const close = () => setSidebarOpen(false);

    const item = (href: string, icon: React.ReactNode, label: string, active: boolean) => (
        <Link href={href} onClick={close} className={join(page.action_btn, styles.link, active ? styles.active : "")}>
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
        >
            {item("/projects", <FolderOpen size={16} />, t("backToApp"), false)}
            {me?.profile && (
                <>
                    <div className={styles.divider} />
                    {item("/community/coverage/submit", <Upload size={16} />, t("submit"), pathname.startsWith("/community/coverage/submit"))}
                    {item("/community/coverage/review", <PenLine size={16} />, t("review"), pathname.startsWith("/community/coverage/review"))}
                    {/* Pinned to the bottom of the column: the sidebar is a flex
                        column and this is the only item that grows. */}
                    <div className={styles.tickets} title={t("ticketsTitle")}>
                        <Ticket size={14} className={styles.ticketsIcon} />
                        <span>{t("tickets", { count: me.balance })}</span>
                    </div>
                </>
            )}
        </LibrarySidebar>
    );
};

export default CommunitySidebar;
