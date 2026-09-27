"use client";

import Link from "next/link";

import styles from "./Landing.module.css";
import { GitHubIcon, RedditIcon, XIcon, YouTubeIcon } from "./PlatformIcons";

const SOCIALS = [
    { href: "https://www.youtube.com/@scenarly", label: "YouTube", icon: <YouTubeIcon /> },
    { href: "https://x.com/scenarly", label: "X (Twitter)", icon: <XIcon /> },
    { href: "https://www.reddit.com/r/scenarly", label: "Reddit", icon: <RedditIcon /> },
    { href: "https://github.com/Lycoon/scenarly", label: "GitHub", icon: <GitHubIcon /> },
];

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <div className={styles.footerLegal}>
                    <p>© 2026 Scenarly by Arko Logic</p>
                    <Link href="/privacy" className={styles.footerLink}>
                        Privacy
                    </Link>
                    <Link href="/terms" className={styles.footerLink}>
                        Terms
                    </Link>
                </div>
                <div className={styles.footerLinks}>
                    {SOCIALS.map(({ href, label, icon }) => (
                        <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={label}
                            title={label}
                            className={styles.footerSocial}
                        >
                            {icon}
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
}
