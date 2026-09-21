"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { join } from "@src/lib/utils/misc";
import { useIsPhone } from "@src/lib/utils/hooks";

import Logo from "@public/images/scenarly.svg";
import page from "./ProjectPageContainer.module.css";

interface LibrarySidebarProps {
    /** Phone only: whether the drawer is open. Desktop always shows the column. */
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    /** Title of the phone drawer (desktop shows the logo instead). */
    title: string;
    /** Small caps line under the logo on desktop (e.g. the section name). */
    subtitle?: string;
    /** Right-aligned control on the logo row (phone: next to the close button). */
    topRight?: ReactNode;
    /** The action pills / navigation under the logo band. */
    children: ReactNode;
}

/**
 * The left column of the app's list-style pages: the projects library and the
 * Community pages share it so they read as one place. Desktop: a permanent
 * fixed column with the logo in a navbar-height band; phone: an overlay drawer
 * with a title and a close button, opened by the navbar burger.
 */
const LibrarySidebar = ({ sidebarOpen, setSidebarOpen, title, subtitle, topRight, children }: LibrarySidebarProps) => {
    const isPhone = useIsPhone();
    const tNav = useTranslations("navbar");

    return (
        <>
            {/* Phone: dim + dismiss layer behind the open drawer. */}
            {isPhone && sidebarOpen && <div className={page.backdrop} onClick={() => setSidebarOpen(false)} />}

            <aside className={join(page.sidebar, !sidebarOpen ? page.sidebar_closed : "")}>
                {/* Desktop shows the branded logo in a navbar-height band. On phone this
                    is a drawer matching the dashboard settings drawer, so it wears the
                    same title + close header instead. */}
                <div className={page.sidebar_top}>
                    {isPhone ? (
                        <h2 className={page.sidebar_title}>{title}</h2>
                    ) : (
                        <div className={page.sidebar_brand}>
                            <Logo className={page.logo} />
                            {subtitle && <span className={page.sidebar_subtitle}>{subtitle}</span>}
                        </div>
                    )}
                    <div className={page.sidebar_top_right}>
                        {topRight}
                        {isPhone && (
                            <button className={page.sidebar_close} onClick={() => setSidebarOpen(false)} aria-label={tNav("close")}>
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
                <div className={page.sidebar_actions}>{children}</div>
            </aside>
        </>
    );
};

export default LibrarySidebar;
