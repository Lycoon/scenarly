"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Info, LogIn, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Category, MenuSection } from "./DashboardSidebar";
import styles from "./DashboardModal.module.css";
import dangerStyles from "./project/DangerZone.module.css";
import modal from "../utils/ModalBtn.module.css";
import { signOutAccount } from "@src/lib/utils/auth-actions";
import { useCookieUser } from "@src/lib/utils/hooks";

interface DashboardNavListProps {
    structure: MenuSection[];
    /** Row to highlight. Omitted where no tab is showing (the phone burger menu). */
    activeTab?: Category;
    onSelect: (id: Category) => void;
    /** Runs after a confirmed sign-out, to close or leave whatever hosts the list. */
    onSignedOut: () => void;
}

/**
 * The dashboard's sections list: tab groups, then the Sign in / Log out + About
 * footer. Rendered by the dashboard sidebar ([DashboardSidebar]) and by the phone
 * burger menu on a project ([ProjectNavbarMobile]), which on phone *is* that
 * sidebar, so both drawers share one markup, one set of classes and one sign-out
 * flow. Returns a fragment: the dashboard sidebar pins the footer to its bottom
 * with margin-top:auto, which needs both blocks to be its own flex children.
 */
const DashboardNavList = ({ structure, activeTab, onSelect, onSignedOut }: DashboardNavListProps) => {
    const { user, isLoading: isUserLoading } = useCookieUser();
    const t = useTranslations("sidebar");
    const tModal = useTranslations("modal");
    const [showLogOutConfirm, setShowLogOutConfirm] = useState(false);

    const onLogOut = async () => {
        setShowLogOutConfirm(false);
        await signOutAccount();
        onSignedOut();
    };

    const itemClass = (id: Category) => `${styles.navItem} ${activeTab === id ? styles.active : ""}`;

    return (
        <>
            {/* Portal to <body>: .modal's will-change: transform makes it the containing
                block for fixed descendants, which would confine this overlay to the
                drawer on phone. Only ever open after a click, so `document` exists. */}
            {showLogOutConfirm &&
                createPortal(
                    <div className={dangerStyles.overlay} onClick={() => setShowLogOutConfirm(false)}>
                        <div className={dangerStyles.modal} onClick={(e) => e.stopPropagation()}>
                            <h2 className={dangerStyles.modalTitle}>{t("logOutConfirmTitle")}</h2>
                            <p className={dangerStyles.modalDescription}>{t("logOutConfirmDesc")}</p>
                            <div className={dangerStyles.modalActions}>
                                <button
                                    className={`${modal.modalBtn} ${modal.modalBtnDanger}`}
                                    onClick={onLogOut}
                                >
                                    {t("logOutConfirmBtn")}
                                </button>
                                <button
                                    className={`${modal.modalBtn} ${modal.modalBtnCancel}`}
                                    onClick={() => setShowLogOutConfirm(false)}
                                >
                                    {t("logOutCancelBtn")}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
            <nav className={styles.navMenu}>
                {structure.map((section) => (
                    <div key={section.group}>
                        <h4 className={styles.groupLabel}>{section.group}</h4>
                        {section.items.map((item) => (
                            <button key={item.id} className={itemClass(item.id)} onClick={() => onSelect(item.id)}>
                                <span className={styles.iconWrapper}>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>
            <div className={`${styles.navMenu} ${styles.navMenuFooter}`}>
                {/* While the user query is in flight, leave the slot empty rather than
                    rendering a "Sign in" button against an unknown auth state — clicking
                    it during loading races the SWR resolution and ends up on Profile. */}
                {isUserLoading ? null : user ? (
                    <button className={styles.navItem} onClick={() => setShowLogOutConfirm(true)}>
                        <LogOut size={18} />
                        {t("logOut")}
                    </button>
                ) : (
                    <button className={itemClass("Auth")} onClick={() => onSelect("Auth")}>
                        <LogIn size={18} />
                        {t("auth")}
                    </button>
                )}
                <button className={itemClass("About")} onClick={() => onSelect("About")}>
                    <Info size={18} />
                    {tModal("tabs.About")}
                </button>
            </div>
        </>
    );
};

export default DashboardNavList;
