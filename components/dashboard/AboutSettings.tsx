"use client";

import { MouseEvent, ReactNode, useSyncExternalStore } from "react";
import ScenarlyLogo from "@public/images/scenarly.svg";
import { Tag, GitCommit, MonitorSmartphone, Globe, Mail, Shield, ExternalLink } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { osName } from "@src/lib/utils/platform";
import { openExternal } from "@src/lib/utils/open-external";
import styles from "./AboutSettings.module.css";

const REPO_URL = "https://github.com/Lycoon/scriptio";
const SITE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const LINKS = [
    { label: "Website", href: SITE_URL, Icon: Globe },
    { label: "Contact", href: `${SITE_URL}/contact`, Icon: Mail },
    { label: "Privacy policy", href: `${SITE_URL}/privacy`, Icon: Shield },
] as const;

const emptySubscribe = () => () => {};

/** Which shell is running the app, e.g. "Windows app" / "iOS app" / "Web". */
const platformLabel = (): string => {
    const os = osName();
    if (!isTauri()) return os ? `Web · ${os}` : "Web";
    return os ? `${os} app` : "Desktop app";
};

/** Anchor that keeps a real href on the web but leaves the webview in Tauri. */
const ExternalAnchor = ({ href, className, children }: { href: string; className?: string; children: ReactNode }) => {
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (!isTauri()) return;
        e.preventDefault();
        void openExternal(href);
    };
    return (
        <a href={href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
            {children}
        </a>
    );
};

const AboutSettings = () => {
    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
    const buildId = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local";
    const commitUrl = buildId === "local" ? null : `${REPO_URL}/commit/${buildId}`;

    // The label reads the user agent and Tauri globals, so the server snapshot
    // is empty and the client fills it in after hydration (no setState-in-effect).
    const platform = useSyncExternalStore(emptySubscribe, platformLabel, () => null);

    return (
        <div className={styles.container}>
            <div className={styles.brandSection}>
                <div className={styles.logoWrapper}>
                    <ScenarlyLogo className={styles.logo} />
                </div>
                <h1 className={styles.title}>Scenarly</h1>
                <p className={styles.copyright}>© {new Date().getFullYear()} Arko Logic</p>
            </div>

            <div className={styles.infoSection}>
                <div className={styles.row}>
                    <div className={styles.labelGroup}>
                        <Tag size={18} className={styles.icon} />
                        <span className={styles.label}>Version</span>
                    </div>
                    <span className={styles.value}>v{version}</span>
                </div>
                <div className={styles.row}>
                    <div className={styles.labelGroup}>
                        <GitCommit size={18} className={styles.icon} />
                        <span className={styles.label}>Build</span>
                    </div>
                    {commitUrl ? (
                        <ExternalAnchor href={commitUrl} className={`${styles.value} ${styles.link}`}>
                            {buildId}
                            <ExternalLink size={14} />
                        </ExternalAnchor>
                    ) : (
                        <span className={styles.value}>{buildId}</span>
                    )}
                </div>
                <div className={styles.row}>
                    <div className={styles.labelGroup}>
                        <MonitorSmartphone size={18} className={styles.icon} />
                        <span className={styles.label}>Platform</span>
                    </div>
                    <span className={styles.value}>{platform ?? "—"}</span>
                </div>
            </div>

            <div className={styles.infoSection}>
                {LINKS.map(({ label, href, Icon }) => (
                    <ExternalAnchor key={label} href={href} className={`${styles.row} ${styles.linkRow}`}>
                        <div className={styles.labelGroup}>
                            <Icon size={18} className={styles.icon} />
                            <span className={styles.label}>{label}</span>
                        </div>
                        <ExternalLink size={16} className={styles.icon} />
                    </ExternalAnchor>
                ))}
            </div>
        </div>
    );
};

export default AboutSettings;
