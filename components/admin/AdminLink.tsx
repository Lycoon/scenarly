"use client";

import { CSSProperties, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { isTauri } from "@tauri-apps/api/core";
import { AdminRoute, adminPath, adminSearch } from "@src/lib/admin-route";
import { useAppNavigation } from "@src/lib/utils/navigation";

type Props = {
    /** An admin screen, or "app" for the projects list. */
    to: AdminRoute | "app";
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
};

/**
 * Link between admin screens. The web app follows the `/admin` routes; the
 * Tauri shells swap the projects page's search params instead, since the
 * static export has no `/admin` pages and a router navigation would leave the
 * `projects.html` entry (see navigation.ts).
 */
export default function AdminLink({ to, className, style, children }: Props) {
    const { goToAdmin, goToProjects } = useAppNavigation();

    if (!isTauri()) {
        return (
            <Link href={to === "app" ? "/" : adminPath(to)} className={className} style={style}>
                {children}
            </Link>
        );
    }

    const onClick = (e: MouseEvent) => {
        e.preventDefault();
        if (to === "app") goToProjects();
        else goToAdmin(to);
    };

    return (
        <a href={to === "app" ? "?" : adminSearch(to)} onClick={onClick} className={className} style={style}>
            {children}
        </a>
    );
}
