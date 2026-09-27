"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

import styles from "./LandingPageNavbar.module.css";

// The static landing only has four routes; derive the current one from the
// pathname (mirrors the app's usePage() without pulling in the app's hooks).
type LandingPage = "index" | "manifesto" | "privacy" | "contact";

// /community is served by the app, not this static site: same origin in
// production, the app's dev URL locally (see HomePageContainer).
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";

// Set on the hero's logo in HomePageContainer; the centered navbar logo shows
// once it has scrolled out of sight.
const HERO_LOGO_ID = "hero-logo";

function usePage(): LandingPage | undefined {
    const pathname = usePathname();
    if (!pathname) return undefined;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "index";
    const last = segments[segments.length - 1];
    return last === "manifesto" || last === "privacy" || last === "contact" ? last : "index";
}

export default function LandingPageNavbar() {
    const page = usePage();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [heroLogoHidden, setHeroLogoHidden] = useState(false);
    const navRef = useRef<HTMLElement>(null);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        const readScrollY = (target: EventTarget | null): number => {
            if (!target || target === document) return window.scrollY;
            if (target instanceof HTMLElement) return target.scrollTop;
            return 0;
        };
        const onScroll = (e: Event) => {
            setScrolled(readScrollY(e.target) > 16);
        };
        document.addEventListener("scroll", onScroll, { capture: true, passive: true });
        return () => document.removeEventListener("scroll", onScroll, { capture: true });
    }, []);

    useEffect(() => {
        if (page !== "index") return;
        const heroLogo = document.getElementById(HERO_LOGO_ID);
        if (!heroLogo) return;
        // Shrink the viewport by the navbar's height so the logo counts as gone
        // as soon as it slides under the bar, not when it leaves the screen.
        const navHeight = navRef.current?.offsetHeight ?? 0;
        const observer = new IntersectionObserver(
            ([entry]) => setHeroLogoHidden(!entry.isIntersecting),
            { rootMargin: `-${navHeight}px 0px 0px 0px` }
        );
        observer.observe(heroLogo);
        return () => observer.disconnect();
    }, [page]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    if (!page) return null;

    const close = () => setOpen(false);

    // The page scrolls inside the landing wrapper rather than the window, so
    // rewind whichever ancestor of the hero is scrolled.
    const scrollToTop = () => {
        for (let el = document.getElementById(HERO_LOGO_ID)?.parentElement; el; el = el.parentElement) {
            if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: "smooth" });
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <nav ref={navRef} className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ""}`}>
            {page !== "index" && (
                <Link className={styles.logoWrapper} href="/">
                    <Image
                        src="/_site/images/scenarly.png"
                        alt="Scenarly Logo"
                        width={90}
                        height={27}
                        className={styles.logo}
                    />
                </Link>
            )}

            {page === "index" && (
                <button
                    className={`${styles.centerLogo} ${heroLogoHidden ? styles.centerLogoVisible : ""}`}
                    onClick={scrollToTop}
                    aria-label="Back to top"
                    aria-hidden={!heroLogoHidden}
                    tabIndex={heroLogoHidden ? 0 : -1}
                >
                    <Image
                        src="/_site/images/scenarly.png"
                        alt=""
                        width={90}
                        height={27}
                        className={styles.logo}
                    />
                </button>
            )}

            <div className={styles.navLinks}>
                {page === "index" && (
                    <>
                        <Link className={styles.navLink} href="#features">Features</Link>
                        <Link className={styles.navLink} href="#faq">FAQ</Link>
                    </>
                )}
            </div>

            <div className={styles.navLinks}>
                <Link className={styles.navLink} href="/manifesto">Manifesto</Link>
                <a className={styles.navLink} href={`${APP_ORIGIN}/community`}>Community</a>
                <Link className={styles.navLink} href="/contact">Contact</Link>
            </div>

            <button
                className={styles.burgerBtn}
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
            >
                {open ? <X size={22} /> : <Menu size={22} />}
            </button>

            {open && (
                <div className={styles.mobileMenu}>
                    {page === "index" && (
                        <>
                            <Link className={styles.mobileLink} href="#features" onClick={close}>Features</Link>
                            <Link className={styles.mobileLink} href="#faq" onClick={close}>FAQ</Link>
                        </>
                    )}
                    <Link className={styles.mobileLink} href="/manifesto" onClick={close}>Manifesto</Link>
                    <a className={styles.mobileLink} href={`${APP_ORIGIN}/community`} onClick={close}>Community</a>
                    <Link className={styles.mobileLink} href="/contact" onClick={close}>Contact</Link>
                </div>
            )}
        </nav>
    );
}
