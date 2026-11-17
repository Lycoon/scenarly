"use client";

import { ReactNode, useContext } from "react";
import { DashboardContext } from "@src/context/DashboardContext";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./DashboardModal.module.css";
import DashboardNavList from "./DashboardNavList";

export type Category =
    | "General"
    | "Layout"
    | "Production"
    | "Export"
    | "Storage"
    | "Collaborators"
    | "Profile"
    | "Subscription"
    | "Settings"
    | "Keybinds"
    | "Appearance"
    | "Language"
    | "Auth"
    | "About";

export interface MenuItem {
    id: Category;
    label: string;
    icon: ReactNode;
}

export interface MenuSection {
    group: string;
    items: MenuItem[];
}

interface SidebarMenuProps {
    structure: MenuSection[];
    activeTab: Category;
    onTabChange: (id: Category) => void;
}

const SidebarMenu = ({ structure, activeTab, onTabChange }: SidebarMenuProps) => {
    const { closeDashboard } = useContext(DashboardContext);
    const t = useTranslations("sidebar");
    const tNav = useTranslations("navbar");

    return (
        <aside className={styles.sidebar}>
            {/* The close button only shows on phone, where this list is a
                full-drawer screen with no content header to close from. */}
            <div className={styles.sidebarHeader}>
                <h2 className={styles.sidebarTitle}>{t("title")}</h2>
                <button className={styles.sidebarClose} onClick={closeDashboard} aria-label={tNav("close")}>
                    <X size={18} />
                </button>
            </div>
            <DashboardNavList
                structure={structure}
                activeTab={activeTab}
                onSelect={onTabChange}
                onSignedOut={closeDashboard}
            />
        </aside>
    );
};

export default SidebarMenu;
