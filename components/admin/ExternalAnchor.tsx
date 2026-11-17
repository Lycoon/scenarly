"use client";

import { MouseEvent, ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openExternal } from "@src/lib/utils/open-external";

type Props = { href: string; className?: string; children: ReactNode };

/**
 * A link to an outside dashboard (Stripe, Grafana…). `target="_blank"` stays
 * trapped in the Tauri webviews, so there it goes through the opener plugin.
 */
export default function ExternalAnchor({ href, className, children }: Props) {
    const onClick = (e: MouseEvent) => {
        if (!isTauri()) return;
        e.preventDefault();
        void openExternal(href);
    };

    return (
        <a href={href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
            {children}
        </a>
    );
}
