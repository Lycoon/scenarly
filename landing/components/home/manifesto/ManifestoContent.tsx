"use client";

import styles from "../Landing.module.css";
import Footer from "../Footer";
import ScriptMarquee from "../ScriptMarquee";

export default function ManifestoContent() {
    return (
        <div className={styles.pageWrapper}>
            <div className={styles.gradientBackground}></div>
            <ScriptMarquee fixed />
            <div className={`${styles.pageContainer} ${styles.readingColumn}`}>
                <h1 className={styles.pageTitle}>Manifesto</h1>

                <section>
                    <p className={styles.pageText}>
                        Although it may sound grandiose, the term “manifesto” was chosen deliberately to characterize
                        the scope of Scenarly’s ambitions. These ambitions, which are nothing revolutionary on their own,
                        express, when taken together, Scenarly’s unique identity within the screenplay editor landscape.
                        The very existence of this project stems from the realization that, as a computer science
                        student and amateur screenwriter, I couldn’t find a tool that suited my needs. What was missing
                        back then was ergonomics, affordable pricing, or cross-platform availability. Writing
                        screenplays isn’t everyone’s full-time job, and not everyone can afford high-priced
                        software, assuming it’s even worth it in the first place.
                    </p>
                    <p className={styles.pageText}>
                        What few or no screenplay software companies will tell you is that they develop completely
                        dispensable tools, yet convince you otherwise just to write a good script. The truth is that
                        stories have never waited for nor needed specific margins or the Courier font to be told. Many
                        people get along just fine without these tools, writing their stories in Word or Notepad;
                        let’s give them a reason to switch. If screenwriters are opting out of these tools or using
                        them begrudgingly for lack of a better alternative, it is up to us to offer tools that meet the
                        challenge and forge a new path. A path that respects their habits, never limits their projects
                        behind a paywall or watermark, works without an internet connection, collects no data, keeps
                        its source code open, and is available across all platforms. Scenarly addresses all these issues at once.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Transparency</h2>
                    <p className={styles.pageText}>
                        This is the first of Scenarly’s three core values. Though it might seem political at first
                        glance, choosing open development for Scenarly was my intention right from the project’s
                        inception in 2022. It isn’t just marketing bullshit to win over the community, but a deep
                        desire to seal a pact of trust with it. In these uncertain times when we, as digital
                        consumers, are increasingly dispossessed of our purchases, it felt essential to steer
                        development toward a tool that belongs as much to me as it does to its users. This brings about
                        several virtuous outcomes.
                    </p>
                    <p className={styles.pageText}>
                        The first is that Scenarly will survive beyond its own existence. If for any reason
                        Scenarly’s presence on app stores or service continuity cannot be maintained, anyone would be
                        free to download the source code onto their computer and use it for personal use. It’s a
                        safety net that very few screenplay editors guarantee (Trelby and Story Architect, to name a
                        few).
                    </p>
                    <p className={styles.pageText}>
                        The second is the open inspection of algorithms and communications with our server,
                        particularly in the context of real-time collaboration. The third-party libraries used during
                        development are fully accessible, ensuring that none intercept and transmit data to an
                        external party. Another benefit is that anyone who wishes to can audit the code at their
                        leisure to verify its robustness or find and fix vulnerabilities.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Simplicity</h2>
                    <p className={styles.pageText}>
                        Screenwriting is an art, and like any art, it can just be a hobby, so why force one or the other
                        on an author? Many screenplay editors, and text processors in general, fail to prioritize
                        information correctly, either by needlessly distracting the user or burying features in a maze
                        of submenus. Scenarly pays special attention to interface design to preserve the writing
                        experience as much as possible.
                    </p>
                    <p className={styles.pageText}>
                        Another category of so-called “minimalist” word processors refrains from offering advanced
                        features. While Scenarly shares the goal of keeping writers free from distractions with an
                        interface that is as organic and minimalist as possible, it is more than just a simple word
                        processor: it aims to overcome the flaws and match the features of market leaders.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Accessibility</h2>
                    <p className={styles.pageText}>
                        Speaking of market leaders, despite their dominant position and record profits, legacy players
                        are abandoning their users. Examples are plentiful:
                    </p>
                    <ul className={styles.pageText}>
                        <li>
                            Writing on Windows with Final Draft? The Windows experience has felt neglected for years,
                            lagging behind in performance and interface design.
                        </li>
                        <li>
                            Wanting to use Fade In on your phone? The mobile version has been discontinued and simply
                            no longer exists.
                        </li>
                        <li>
                            Looking to truly collaborate? Neither app allows a co-author to join a project at any time
                            without a session being manually launched by the host.
                        </li>
                    </ul>
                    <p className={styles.pageText}>
                        In an attempt to modernize and respond to competition, both recently released a web version
                        that doesn’t even include all their features. On top of failing to address the first two points
                        and only partially fixing the third, expect to pay up to $250 per update for the former and $80
                        for the latter, to which you must add $10/month for cloud sync!
                    </p>
                    <p className={styles.pageText}>
                        We believe accessibility must be twofold: cross-platform and financial. We are not a charity,
                        but we refuse to charge prices that would sideline users due to a lack of means.
                    </p>
                </section>
            </div>
            <Footer />
        </div>
    );
}
