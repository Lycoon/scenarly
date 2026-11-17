"use client";

import { ReactNode } from "react";
import { BarChart3, Users, FolderOpen, LogOut } from "lucide-react";
import ScenarlyLogo from "@public/images/scenarly.svg";
import { AdminSection } from "@src/lib/admin-route";
import AdminLink from "./AdminLink";
import styles from "./AdminShell.module.css";

type NavLink = { section: AdminSection; label: string; icon: ReactNode };

const NAV_LINKS: NavLink[] = [
    { section: "overview", label: "Overview", icon: <BarChart3 size={16} /> },
    { section: "users", label: "Users", icon: <Users size={16} /> },
    { section: "projects", label: "Projects", icon: <FolderOpen size={16} /> },
];

type Props = {
    email: string;
    /** The nav entry to highlight. */
    section: AdminSection;
    title: string;
    subtitle?: string;
    children: ReactNode;
};

export default function AdminShell({ email, section, title, subtitle, children }: Props) {
    return (
        <div className={styles.wrapper}>
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                    <ScenarlyLogo className={styles.brandLogo} role="img" aria-label="Scenarly" />
                    <span className={styles.brandBadge}>Admin</span>
                </div>
                <span className={styles.brandEmail} title={email}>{email}</span>
                <nav className={styles.nav}>
                    <div className={styles.navGroupLabel}>Monitoring</div>
                    {NAV_LINKS.map((link) => (
                        <AdminLink
                            key={link.section}
                            to={{ section: link.section }}
                            className={`${styles.navItem} ${link.section === section ? styles.navItemActive : ""}`}
                        >
                            {link.icon}
                            {link.label}
                        </AdminLink>
                    ))}
                </nav>
                <div className={styles.footer}>
                    <AdminLink to="app" className={styles.navItem} style={{ padding: "8px 0" }}>
                        <LogOut size={14} />
                        Back to app
                    </AdminLink>
                </div>
            </aside>
            <main className={styles.main}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                </div>
                {children}
            </main>
        </div>
    );
}
