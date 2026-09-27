import styles from "./Landing.module.css";

/**
 * The slanted, slowly scrolling screenplay lines behind the landing pages.
 * `fixed` pins them to the viewport instead of the page, for pages much taller
 * than one screen (the manifesto), where they'd otherwise sit in the middle of
 * the document and scroll away.
 */
export default function ScriptMarquee({ fixed = false }: { fixed?: boolean }) {
    return (
        <div className={`${styles.marqueeContainer} ${fixed ? styles.marqueeFixed : ""}`}>
            <ScriptStripe speed="slow" direction="left">
                INT. COFFEE SHOP - DAY — The steam rises slowly from the cup.
            </ScriptStripe>
            <ScriptStripe speed="fast" direction="right">
                EXT. CITY STREET - NIGHT — Rain slicks the pavement neon.
            </ScriptStripe>
            <ScriptStripe speed="medium" direction="left" opacity={0.25}>
                FADE IN: A world built for storytellers. CUT TO:
            </ScriptStripe>
            <ScriptStripe speed="fast" direction="right">
                (V.O.) &quot;It starts with a single page...&quot;
            </ScriptStripe>
            <ScriptStripe speed="slow" direction="left">
                CLOSE UP on the keyboard. Fingers flying. DISSOLVE TO:
            </ScriptStripe>
        </div>
    );
}

interface ScriptStripeProps {
    children: React.ReactNode;
    speed?: "slow" | "medium" | "fast";
    direction?: "left" | "right";
    opacity?: number;
}

const ScriptStripe: React.FC<ScriptStripeProps> = ({ children, speed = "medium", direction = "left", opacity }) => {
    const repetitions = [1, 2, 3, 4, 5, 6, 7, 8];

    return (
        <div className={styles.stripe}>
            <div
                className={`${styles.track} ${direction === "left" ? styles.scrollLeft : styles.scrollRight} ${
                    styles[speed]
                }`}
            >
                {/* First Set */}
                {repetitions.map((i) => (
                    <span key={`a-${i}`} className={styles.stripeText} style={opacity ? { opacity } : {}}>
                        {children} <span className={styles.cursor}></span>
                    </span>
                ))}

                {/* Duplicate Set (Required for seamless CSS loop) */}
                {repetitions.map((i) => (
                    <span key={`b-${i}`} className={styles.stripeText} style={opacity ? { opacity } : {}}>
                        {children} <span className={styles.cursor}></span>
                    </span>
                ))}
            </div>
        </div>
    );
};
