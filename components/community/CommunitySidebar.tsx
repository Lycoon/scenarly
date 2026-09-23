"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Files, FolderOpen, PenLine, Ticket, Upload } from "lucide-react";

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
 * actions: their submissions to either half, the two things they can do
 * (submit to Showcase or Coverage, review), and the way back to the projects
 * library (also the logo); for a member, their balance too. The links show
 * even before someone can use them: each page sits behind [CoverageGate],
 * which walks them through signing in or setting up a profile. Switching between
 * Showcase and Coverage is the navbar's job (see [CommunityTabs]).
 */
const CommunitySidebar = ({ sidebarOpen, setSidebarOpen }: CommunitySidebarProps) => {
    const t = useTranslations("community.nav");
    const tProjects = useTranslations("projects");
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
            logoHref="/projects"
        >
            {item("/community/submissions", <Files size={16} />, t("mySubmissions"), pathname.startsWith("/community/submissions"))}
            {item("/community/submit", <Upload size={16} />, t("submit"), pathname === "/community/submit")}
            {item("/community/coverage/review", <PenLine size={16} />, t("review"), pathname.startsWith("/community/coverage/review"))}
            <div className={page.sidebar_footer}>
                {item("/projects", <FolderOpen size={16} />, tProjects("pageTitle"), false)}
                {me?.profile && (
                    <div className={styles.tickets} title={t("ticketsTitle")}>
                        <Ticket size={14} className={styles.ticketsIcon} />
                        <span>{t("tickets", { count: me.balance })}</span>
                    </div>
                )}
            </div>
        </LibrarySidebar>
    );
};

export default CommunitySidebar;
