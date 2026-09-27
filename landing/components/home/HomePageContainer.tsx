"use client";

import styles from "./Landing.module.css";
import {
    Archive,
    WifiOff,
    MessagesSquare,
    MessageSquareQuote,
    Clapperboard,
    ChartPie,
    Cloud,
    Globe,
    Search,
    PenLine,
    Ruler,
    FileLock,
    FileOutput,
    FolderTree,
    LayoutDashboard,
    Layers,
    Palette,
    Users,
    type LucideIcon,
} from "lucide-react";
import Footer from "./Footer";
import ScriptMarquee from "./ScriptMarquee";
import Image from "next/image";
import { useState } from "react";
import { AppleIcon, GooglePlayIcon, LinuxIcon, WindowsIcon } from "./PlatformIcons";

// The app lives at the same origin in production (`/projects` is relative), but
// at a different port in local dev. NEXT_PUBLIC_APP_ORIGIN is set to the app's
// dev URL in .env.development and is empty in the production build.
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";

const APP_STORE_URL = "https://apps.apple.com/app/scenarly";
const MICROSOFT_STORE_URL = "https://apps.microsoft.com/detail/9p4m1xphjks1";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=app.scriptio";

const DESKTOP_STORES: StoreLink[] = [
    { href: APP_STORE_URL, name: "App Store", icon: <AppleIcon size={18} /> },
    { href: MICROSOFT_STORE_URL, name: "Microsoft Store", icon: <WindowsIcon size={16} /> },
];

const MOBILE_STORES: StoreLink[] = [
    { href: APP_STORE_URL, name: "App Store", icon: <AppleIcon size={18} /> },
    { href: GOOGLE_PLAY_URL, name: "Google Play", icon: <GooglePlayIcon size={17} /> },
];

type Feature = {
    icon: LucideIcon;
    title: string;
    text: string;
    // Preview screenshot, shown as a thumbnail left of the text.
    image: string;
    // Needs the Cloud plan; shows the "Cloud" badge.
    cloud?: boolean;
};

const FEATURES: Feature[] = [
    {
        icon: PenLine,
        title: "First-class Editor",
        image: "/_site/images/previews/auto-complete.png",
        text: "Smart auto-complete, built-in spellchecker, and keyboard shortcuts keep you in flow. Fountain syntax rules automatically format your script as you type. Focus mode fades out the noise so only your words remain.",
    },
    {
        icon: Ruler,
        title: "Professional Formatting",
        image: "/_site/images/previews/auto-complete.png",
        text: "Dual dialogue, customizable margins, font styling, and spacing — every layout detail is yours to control. Page breaks follow industry standards out of the box. Your script looks camera-ready from page one.",
    },
    {
        icon: FileOutput,
        title: "Portability",
        image: "/_site/images/previews/formats.png",
        text: "Bring your existing scripts over from Final Draft, WriterSolo, FadeIn, or Fountain, and export them with full fidelity. Switch tools without losing a single line of formatting. Your screenplay is never locked into one ecosystem.",
    },
    {
        icon: FileLock,
        title: "Production Ready",
        image: "/_site/images/previews/auto-complete.png",
        text: "Take your script from draft to shoot. Track every change in revision mode with industry-standard colored pages and marks. Lock scenes and pages so numbering holds through rewrites, and send out only the pages that changed.",
    },
    {
        icon: Search,
        title: "Advanced Search",
        image: "/_site/images/previews/search.png",
        text: "Search your script with precision using filters for scene, character, and dialogue. Replace with confidence using live preview before committing any change. Find patterns across hundreds of pages in an instant.",
    },
    {
        icon: Archive,
        title: "Alternates",
        image: "/_site/images/previews/search.png",
        text: "Not sure a scene works? Shelve it and try another take without losing the original. Keep alternate versions of any scene, dialogue, or action and rework them side by side with your script.",
    },
    {
        icon: LayoutDashboard,
        title: "Boards",
        image: "/_site/images/previews/auto-complete.png",
        text: "Map out your story on an infinite canvas. Pin text cards, reference images, and voice notes, then link them together to see how ideas connect. Brainstorm freely before a single scene is written.",
    },
    {
        icon: FolderTree,
        title: "File Hierarchy",
        image: "/_site/images/previews/auto-complete.png",
        text: "Keep treatments, notes, and boards right next to your screenplay. Organize them into nested folders, reorder with drag and drop, and open any document alongside your script. Everything for your project lives in one place.",
    },
    {
        icon: Palette,
        title: "Themes",
        image: "/_site/images/previews/themes.png",
        text: "Whether you write at the crack of dawn or burn the midnight oil, find the perfect contrast for your eyes. Choose from light & dark themes designed for long writing sessions. Your environment should inspire, not distract.",
    },
    {
        icon: Clapperboard,
        title: "Scene Navigation",
        image: "/_site/images/previews/scene-navigation.png",
        text: "Navigate your screenplay at the speed of thought with a dynamic scene outline. Track pacing with length estimates and jump anywhere in your script instantly. Reorder scenes, add synopses, and color-code your story structure.",
    },
    {
        icon: Layers,
        title: "Every Angle",
        image: "/_site/images/previews/scene-navigation.png",
        text: "Read your screenplay at whatever level the moment calls for. Write page by page or switch to endless scroll, step back to index cards for the big picture, or lay out every page at once to check the rhythm of your script.",
    },
    {
        icon: Users,
        title: "Character Management",
        image: "/_site/images/previews/character-highlight.png",
        text: "Rename a character across your entire script in one click. Assign traits and descriptions to build rich character profiles. Highlight any character's lines to stay locked in their voice.",
    },
    {
        icon: MessageSquareQuote,
        title: "Dialogue Tuner",
        image: "/_site/images/previews/character-highlight.png",
        text: "Hear each character's voice on its own. Pick a character and the rest of the script fades away, leaving only their lines. Step through every speech they give, from first scene to last, to keep them sounding like themselves.",
    },
    {
        icon: WifiOff,
        title: "Offline First",
        image: "/_site/images/previews/auto-complete.png",
        text: "No internet? No problem. Keep writing without any friction or interruption. Your work is saved locally and synced back to the cloud the moment you reconnect. Scenarly works fully offline, no account required.",
    },
    {
        icon: ChartPie,
        title: "Statistics",
        image: "/_site/images/previews/auto-complete.png",
        text: "Get a clear picture of your screenplay with word count, page count, and scene breakdowns. See how much screen time each character gets and spot pacing gaps at a glance. Data-driven insights to sharpen your story before it hits the screen.",
    },
    {
        icon: Cloud,
        title: "Cloud Sync",
        image: "/_site/images/previews/auto-complete.png",
        text: "Never hit Save again — your words are synced to the cloud continuously. Switch devices, close tabs, or lose power and pick up exactly where you left off. Manual snapshots let you restore any previous version on demand.",
        cloud: true,
    },
    {
        icon: MessagesSquare,
        title: "Real-time Collaboration",
        image: "/_site/images/previews/collaboration.png",
        text: "Invite up to 5 collaborators and write the same screenplay simultaneously in real time. See each other's cursors, edits, and comments as they happen. No merging, no conflicts — just seamless creative flow.",
        cloud: true,
    },
];

export default function HomePageContainer() {
    // Which platform CTA has its store menu open (hover on pointer devices, tap
    // on touch ones — CSS handles hover/focus, this handles the tap).
    const [openMenu, setOpenMenu] = useState<"desktop" | "mobile" | null>(null);

    return (
        <div className={styles.wrapper}>
            <div className={styles.gradientBackground}></div>

            {/* Layer 0: Marquee Stripes (Background) */}
            <ScriptMarquee />

            {/* Layer 1: Main Content Container */}
            <div className={styles.contentContainer}>
                {/* Hero Section */}
                <section id="about" className={styles.hero}>
                    {/* Layer 1.1: Preview Image (Behind Content, In Front of Stripes) */}
                    <div className={styles.heroBackgroundWrapper}>
                        <Image
                            src="/_site/images/landing_preview.png"
                            alt="Scenarly Interface Preview"
                            width={1920}
                            height={1080}
                            loading="eager"
                            className={styles.heroBackgroundImage}
                        />
                    </div>

                    {/* Layer 1.2: Branding (Logo) */}
                    <div className={styles.heroHeader}>
                        <Image
                            src="/_site/images/scenarly.png"
                            id="hero-logo"
                            alt="Scenarly Logo"
                            width={400}
                            height={110}
                            className={styles.heroLogo}
                        />
                    </div>

                    {/* Layer 1.3: Platform CTAs */}
                    <div className={styles.heroContent}>
                        <div className={styles.ctaRow}>
                            <PlatformMenuCta
                                name="Desktop"
                                icons={
                                    <>
                                        <AppleIcon size={20} />
                                        <WindowsIcon size={17} />
                                        <LinuxIcon size={20} />
                                    </>
                                }
                                stores={DESKTOP_STORES}
                                isOpen={openMenu === "desktop"}
                                onToggle={(open) => setOpenMenu(open ? "desktop" : null)}
                            />

                            <PlatformMenuCta
                                name="Mobile"
                                icons={
                                    <>
                                        <AppleIcon size={20} />
                                        <GooglePlayIcon size={18} />
                                    </>
                                }
                                stores={MOBILE_STORES}
                                isOpen={openMenu === "mobile"}
                                onToggle={(open) => setOpenMenu(open ? "mobile" : null)}
                            />

                            {/* `quickstart`: a visitor with an empty library skips the
                                projects list and lands straight in a fresh editor
                                (handled by ProjectPageContainer in the app). */}
                            <a href={`${APP_ORIGIN}/projects?quickstart`} className={styles.ctaPlatform}>
                                <div className={styles.ctaPlatformIcons}>
                                    <Globe size={20} />
                                </div>
                                <div className={styles.ctaPlatformText}>
                                    <span className={styles.ctaPlatformLabel}>Open in</span>
                                    <span className={styles.ctaPlatformName}>Browser</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className={styles.featuresSection}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Everything you need.</h2>
                        <p className={styles.subheadline}>Power features packed into a minimalist interface.</p>
                    </div>

                    <ul className={styles.featureList}>
                        {FEATURES.map(({ icon: Icon, title, text, image, cloud }) => (
                            <li key={title} className={styles.featureItem}>
                                <Image
                                    src={image}
                                    alt={`${title} preview`}
                                    width={1280}
                                    height={720}
                                    className={styles.featureImage}
                                />
                                <div>
                                    <div className={styles.featureHeader}>
                                        <Icon size={18} className={styles.featureIcon} />
                                        <h3 className={styles.featureTitle}>{title}</h3>
                                        {cloud && <span className={styles.cloudBadge}>Cloud</span>}
                                    </div>
                                    <p className={styles.featureText}>{text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* FAQ */}
                <section id="faq" className={styles.faqSection}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
                    </div>

                    <div className={styles.faqList}>
                        <details className={styles.faqItem}>
                            <summary className={styles.faqQuestion}>Is Scenarly free to use?</summary>
                            <p className={styles.faqAnswer}>
                                Scenarly is entirely free. No project limitation, no forced watermark on PDF
                                generation. If you want to sync your projects to the cloud and work in real time with
                                other writers, you can opt into our Cloud plan for a few bucks a month.
                            </p>
                        </details>

                        <details className={styles.faqItem}>
                            <summary className={styles.faqQuestion}>Can I use Scenarly offline?</summary>
                            <p className={styles.faqAnswer}>
                                Absolutely. Scenarly is offline-first: the desktop app works fully offline and no
                                account is needed to use it. If you do want cloud sync or real-time collaboration, you
                                can sign in at any time and your changes will sync automatically.
                            </p>
                        </details>

                        <details className={styles.faqItem}>
                            <summary className={styles.faqQuestion}>What file formats are supported?</summary>
                            <p className={styles.faqAnswer}>
                                You can export your screenplays as PDF, Fountain, Final Draft (FDX), or plain text.
                                For importing, Scenarly reads Fountain and Final Draft (FDX) files, along with
                                WriterSolo and FadeIn projects.
                            </p>
                        </details>

                        <details className={styles.faqItem}>
                            <summary className={styles.faqQuestion}>How does real-time collaboration work?</summary>
                            <p className={styles.faqAnswer}>
                                You can invite up to 5 collaborators to a project. Everyone edits the same screenplay
                                simultaneously with changes appearing in real time.
                            </p>
                        </details>

                        <details className={styles.faqItem}>
                            <summary className={styles.faqQuestion}>Is my data safe?</summary>
                            <p className={styles.faqAnswer}>
                                Your data is hosted entirely on European servers, and all communications are encrypted
                                with TLS. We don't store any passwords: signing in is handled through OAuth with Apple
                                and Google, or an email magic link. We never sell or share your data. Read more in our{" "}
                                <a href="/privacy">privacy policy</a>.
                            </p>
                        </details>

                        <details className={styles.faqItem}>
                            <summary className={styles.faqQuestion}>Is Scenarly open source?</summary>
                            <p className={styles.faqAnswer}>
                                Scenarly is source-available. You can inspect the full codebase on{" "}
                                <a href="https://github.com/Lycoon/scenarly" target="_blank">
                                    GitHub
                                </a>
                                .
                            </p>
                        </details>
                    </div>
                </section>
            </div>

            <Footer />
        </div>
    );
}

interface StoreLink {
    href: string;
    name: string;
    icon: React.ReactNode;
}

interface PlatformMenuCtaProps {
    name: string;
    icons: React.ReactNode;
    stores: StoreLink[];
    isOpen: boolean;
    onToggle: (open: boolean) => void;
}

const PlatformMenuCta: React.FC<PlatformMenuCtaProps> = ({ name, icons, stores, isOpen, onToggle }) => (
    <div
        className={`${styles.ctaMenu} ${isOpen ? styles.ctaMenuOpen : ""}`}
        onMouseEnter={() => onToggle(true)}
        onMouseLeave={() => onToggle(false)}
        onKeyDown={(e) => e.key === "Escape" && onToggle(false)}
    >
        <button
            type="button"
            className={styles.ctaPlatform}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            onClick={() => onToggle(!isOpen)}
        >
            <div className={styles.ctaPlatformIcons}>{icons}</div>
            <div className={styles.ctaPlatformText}>
                <span className={styles.ctaPlatformLabel}>Download for</span>
                <span className={styles.ctaPlatformName}>{name}</span>
            </div>
        </button>

        <div className={styles.ctaDropdown} role="menu" aria-label={`${name} downloads`}>
            <div className={styles.ctaDropdownPanel}>
                {stores.map((store) => (
                    <a
                        key={store.name}
                        href={store.href}
                        target="_blank"
                        role="menuitem"
                        className={styles.ctaDropdownItem}
                    >
                        {store.icon}
                        <span>{store.name}</span>
                    </a>
                ))}
            </div>
        </div>
    </div>
);
