"use client";

import styles from "../Landing.module.css";
import Footer from "../Footer";

// TODO before publishing: fill in the consumer mediator (section 22), mandatory for a
// French business selling to consumers (Code de la consommation, L.612-1).

export default function TermsContent() {
    return (
        <div className={styles.pageWrapper}>
            <div className={styles.gradientBackground}></div>
            <div className={styles.pageContainer}>
                <h1 className={styles.pageTitle}>Terms of Service</h1>

                <section>
                    <p className={styles.pageText}>
                        <i>Last updated September 25, 2026</i>
                    </p>
                    <p className={styles.pageText}>
                        These Terms of Service (the “Terms”) govern your use of Scenarly®: the web application at
                        scenarly.com, the desktop and mobile applications, the optional Cloud plan and the Community
                        (together, the “Services”). By using the Services you agree to these Terms. If you do not
                        agree, please do not use the Services.
                    </p>
                    <p className={styles.pageText}>The short version, which does not replace the full Terms below:</p>
                    <ul>
                        <li className={styles.pageText}>
                            <b>Your scripts are yours.</b> We claim no ownership of anything you write, and we only
                            handle it to run the Services for you.
                        </li>
                        <li className={styles.pageText}>
                            <b>An account is optional.</b> You can write offline without one. You only need one for
                            cloud sync, collaboration and the Community.
                        </li>
                        <li className={styles.pageText}>
                            <b>Showcase is public, Coverage is not.</b> Anyone can read what you publish to Showcase.
                            Scripts sent to Coverage are only shown to the members who review them, and those members
                            must keep them confidential.
                        </li>
                        <li className={styles.pageText}>
                            <b>You can cancel at any time,</b> and consumers in the EU keep their legal right of
                            withdrawal.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Who we are</h2>
                    <p className={styles.pageText}>
                        The Services are provided by Hugo Bois, entrepreneur individuel (EI), trading as Arko Logic,
                        publisher of Scenarly (“Scenarly”, “we”, “us”). Registered in France in the Registre national
                        des entreprises under SIREN 994 900 512 (SIRET 994 900 512 00017), VAT number FR05994900512.
                        Head office: 46 rue de la Saussière, 92100 Boulogne-Billancourt, France. You can reach us at{" "}
                        <a href="mailto:contact@scenarly.com">contact@scenarly.com</a> or through our{" "}
                        <a href="/contact">contact form</a>.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>1. The Services</h2>
                    <p className={styles.pageText}>Scenarly is screenwriting software. It is available:</p>
                    <ul>
                        <li className={styles.pageText}>in a web browser, at scenarly.com;</li>
                        <li className={styles.pageText}>
                            as desktop applications for Windows, macOS and Linux, and as mobile applications for iOS
                            and Android, downloaded from our website or from an app store (the App Store, the
                            Microsoft Store or Google Play) (the “Apps”);
                        </li>
                        <li className={styles.pageText}>
                            with an optional paid <b>Cloud</b> plan that adds synchronization across devices,
                            real-time collaboration, version history and shared cloud storage for project assets;
                        </li>
                        <li className={styles.pageText}>
                            with a <b>Community</b> made of two spaces: <b>Coverage</b>, where members exchange
                            reviews of each other’s scripts, and <b>Showcase</b>, a public wall where writers can
                            share their work.
                        </li>
                    </ul>
                    <p className={styles.pageText}>
                        Scenarly works locally first: without an account, your projects are stored only on your
                        device and never reach our servers.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>2. Your account</h2>
                    <p className={styles.pageText}>
                        You do not need an account to write with Scenarly. An account is required for the Cloud plan,
                        for collaboration and for the Community. Scenarly is passwordless: you sign in with a link
                        sent to your e-mail address, or with Apple or Google. Because anyone who controls your e-mail
                        address or your Apple or Google account can sign in as you, you are responsible for keeping
                        them, and the devices you are signed in on, secure. Tell us promptly if you believe someone
                        else is using your account.
                    </p>
                    <p className={styles.pageText}>
                        You must give us an e-mail address you control and keep it up to date. An account is
                        personal: do not share it, and do not create several accounts to get around a limit or a
                        suspension. We may ask you to change a username that impersonates someone or is offensive.
                    </p>
                    <p className={styles.pageText}>
                        If you are a minor under the law of the country where you live, you may only use the Services
                        with the permission of a parent or legal guardian, who accepts these Terms on your behalf.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>3. Your content</h2>
                    <p className={styles.pageText}>
                        “Your Content” means everything you create, import or upload in the Services: screenplays,
                        boards, notes, images, audio recordings, Community submissions, reviews and any other
                        material. <b>You keep all rights to Your Content.</b> We do not acquire any ownership of it,
                        and nothing in these Terms asks you to waive your moral rights as an author.
                    </p>
                    <p className={styles.pageText}>
                        To run the Services, you give us a non-exclusive, worldwide, royalty-free licence to host,
                        store, back up, copy, transmit, convert (for example into a PDF or a watermarked copy) and
                        display Your Content, only as needed to provide the Services to you and to the people you
                        choose to share it with. This licence lasts as long as Your Content is stored in the Services
                        and ends when you delete it or your account, except for backup copies kept for a limited time
                        and for content that remains available to others as described in sections 5 and 6.
                    </p>
                    <p className={styles.pageText}>
                        We do not sell Your Content, we do not use it for advertising, and we do not use it to train
                        machine-learning models. We only access a private project’s content when you ask us to (for
                        example for support) or when the law requires it.
                    </p>
                    <p className={styles.pageText}>
                        You are responsible for Your Content. You confirm that you have the rights needed to upload
                        it, including the agreement of any co-writer and the rights to any work you adapt, and that it
                        does not break the law or these Terms.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>4. Local projects and cloud projects</h2>
                    <p className={styles.pageText}>
                        <b>Local projects</b> are stored on your device only (in the app’s storage, in your browser’s
                        storage, or in files you save). We have no copy of them and cannot recover them. Clearing your
                        browser data, uninstalling an App or losing a device can delete them, so keep your own
                        backups, for example by saving your project to a file or exporting it.
                    </p>
                    <p className={styles.pageText}>
                        <b>Cloud projects</b> are synchronized to our servers with a Cloud plan. We back them up
                        regularly and take reasonable care to keep them safe, but no system is free of failures, and
                        we recommend that you also export important work from time to time.
                    </p>
                    <p className={styles.pageText}>
                        Cloud storage for images and audio has limits, shown in the app (currently 5 GB per account,
                        shared across all the projects you own, and 50 MB per file). Assets in a project count
                        against its owner’s storage, whoever uploaded them. We will not lower the limits of a paid
                        plan during the period you have already paid for.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>5. Collaboration</h2>
                    <p className={styles.pageText}>
                        The owner of a cloud project, who needs a Cloud plan, can invite other people and choose what
                        each of them can do. Collaborators do not need a Cloud plan. The owner is responsible for
                        whom they invite. Please be aware that:
                    </p>
                    <ul>
                        <li className={styles.pageText}>
                            what you add to someone else’s project becomes part of that project and stays in it if you
                            leave the project or delete your account;
                        </li>
                        <li className={styles.pageText}>
                            if the owner deletes the project or their account, the project is deleted for every
                            collaborator, so keep your own export of any work you care about;
                        </li>
                        <li className={styles.pageText}>
                            the rights between co-writers (who owns what, credits, remuneration) are a matter between
                            you and them; Scenarly is not a party to them.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>6. The Community</h2>
                    <p className={styles.pageText}>
                        The Community is open to signed-in accounts with a verified e-mail address. Some features,
                        such as Coverage, are only available once an account has existed for a minimum period. When
                        you submit a script, you provide a PDF and its details (title, logline, genres, format).
                    </p>

                    <p className={styles.pageText}>
                        <b>Showcase.</b> A script or logline you publish to Showcase is public: anyone can read it,
                        signed in or not, and its page can be indexed by search engines. Verified members can upvote
                        it. We never display your name or username next to it, but the script itself may identify
                        you (for example its title page), so check it before publishing. You allow us to display and
                        reproduce the published script on Showcase, to generate previews of it, and to show its title
                        and logline with a link to it on scenarly.com and our social media accounts, for as long as
                        it stays published. You can take it off Showcase at any time. Once it is off, we stop
                        displaying it, but we cannot control copies that readers or search engines made while it was
                        public.
                    </p>

                    <p className={styles.pageText}>
                        <b>Coverage.</b> Coverage is an exchange of reviews that runs on tickets:
                    </p>
                    <ul>
                        <li className={styles.pageText}>
                            new members receive 3 tickets, submitting a script uses 3 tickets, and each completed
                            review earns 1 ticket;
                        </li>
                        <li className={styles.pageText}>
                            tickets have no monetary value: they cannot be bought, sold, transferred or exchanged for
                            money. We may correct a balance after an error or abuse, and tickets disappear with the
                            account;
                        </li>
                        <li className={styles.pageText}>
                            a submitted script stays in the review pool for at least 30 days and until it has
                            received 3 reviews. We cannot guarantee how many reviews a script receives, or how good
                            they are;
                        </li>
                        <li className={styles.pageText}>
                            a reviewer who claims a script can send the review after 7 days and must send it within
                            21 days. A draft that is long enough is sent automatically at the deadline. A reviewer can
                            give a script back at any time.
                        </li>
                    </ul>

                    <p className={styles.pageText}>
                        <b>Obligations of reviewers.</b> When you review a script in Coverage, you receive a copy
                        watermarked with your identity. You may read it only to write your review. You must not copy,
                        share, publish, adapt, pitch or otherwise use the script or any part of it, and you must not
                        upload it to an AI tool or any other third-party service. Delete any copy you made once your
                        review is sent or the script is given back. Your review must be your own honest work, about
                        the script, and respectful of the writer; reviews that are abusive, off-topic, low-effort or
                        machine-generated can be reported and removed. Reviews are anonymous unless you choose to sign
                        them. You allow the author to read and keep your review, and us to host it and show it to
                        them. If you delete your account, the reviews you sent stay with their authors, anonymised.
                    </p>

                    <p className={styles.pageText}>
                        <b>Proof of existence.</b> When you submit a script, we record a fingerprint of the file
                        (a SHA-256 hash) and the date. This can help show that your file existed on that date, but it
                        is not a copyright registration and we do not guarantee its legal effect. For stronger
                        protection, consider a registration service such as the WGA Registry or an e-Soleau envelope
                        with the INPI.
                    </p>

                    <p className={styles.pageText}>
                        <b>Ideas and similar works.</b> Similar ideas, premises and stories often occur independently.
                        Sharing a script does not stop others from writing about the same subject, and watermarks
                        deter leaks without making them impossible. We are not responsible for what other members do
                        with content you chose to share, but we will act on any breach of these Terms that is
                        reported to us and cooperate with lawful requests, including to identify the holder of a
                        watermarked copy.
                    </p>

                    <p className={styles.pageText}>
                        <b>Withdrawing and deleting.</b> You can withdraw a submission at any time. Its PDF is then
                        deleted from our storage, and it is taken off Showcase. The reviews you received stay readable
                        to you. Tickets are only given back if nobody had claimed the script yet. Deleting your
                        account deletes your submissions, Showcase entries, upvotes and unsent drafts.
                    </p>

                    <p className={styles.pageText}>
                        <b>Moderation and reports.</b> We do not review Community content before it is published, but
                        we may remove content, unpublish or reject a submission, adjust tickets, or suspend access to
                        the Community when content or behaviour breaks the law or these Terms. To report content you
                        believe is illegal, including a script that infringes your rights, e-mail{" "}
                        <a href="mailto:contact@scenarly.com">contact@scenarly.com</a> with the address of the
                        content, why you believe it is illegal, and your name and e-mail address. When we restrict
                        your content or your account, we will tell you why, unless the law prevents it, and you can
                        contest the decision by replying to us.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>7. Feedback</h2>
                    <p className={styles.pageText}>
                        If you send us suggestions or ideas about the Services, you allow us to use them to improve
                        Scenarly without owing you anything, and without this giving us any rights over Your Content.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>8. Plans, prices and payment</h2>
                    <p className={styles.pageText}>
                        The core of Scenarly is free. The Cloud plan is a subscription, billed monthly or yearly.
                        Prices are shown before you subscribe, in your local currency, and include VAT where it
                        applies.
                    </p>
                    <ul>
                        <li className={styles.pageText}>
                            On the website, and in the Windows, Linux and directly downloaded Apps, payment is
                            handled by <b>Stripe</b>. We never see or store your full card details.
                        </li>
                        <li className={styles.pageText}>
                            In Apps downloaded from the App Store (iPhone, iPad and Mac), subscriptions are purchased
                            through <b>Apple</b> and are also subject to Apple’s Media Services Terms and Conditions.
                        </li>
                        <li className={styles.pageText}>
                            In the Android App downloaded from Google Play, subscriptions cannot be purchased for now.
                            You can subscribe and manage your subscription from the web version at scenarly.com, and a
                            plan bought there works in the Android App once you sign in.
                        </li>
                    </ul>
                    <p className={styles.pageText}>
                        A plan is billed by only one of Stripe and Apple at a time. If you subscribe to a plan through
                        Apple while it is billed by Stripe, the Stripe subscription is set to end at the close of its
                        current period, and we do not refund that period.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>9. Renewal, cancellation and price changes</h2>
                    <p className={styles.pageText}>
                        Subscriptions renew automatically for the same period until cancelled. You can cancel at any
                        time, and the plan stays active until the end of the period you have paid for:
                    </p>
                    <ul>
                        <li className={styles.pageText}>
                            Stripe subscriptions: from your account settings in Scenarly, on the web or in the
                            Apps;
                        </li>
                        <li className={styles.pageText}>
                            App Store subscriptions: from your Apple ID subscription settings, at least 24 hours
                            before the end of the current period.
                        </li>
                    </ul>
                    <p className={styles.pageText}>
                        If we change the price of a plan, we will tell you at least 30 days in advance. The new price
                        applies from your next renewal, and you can cancel before then.
                    </p>
                    <p className={styles.pageText}>
                        When a Cloud plan ends, the features that need it stop working (for example creating cloud
                        projects, uploading assets, saving named versions and inviting collaborators). Your cloud
                        projects are not deleted because your plan ended, and you can still export them.
                    </p>
                    <p className={styles.pageText}>
                        Deleting your account ends a Stripe subscription immediately, and the rest of the paid period
                        is lost. It does not end an App Store subscription: only you can cancel it, from your Apple ID
                        settings, so cancel it there before deleting your account, or Apple will keep billing you.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>10. Right of withdrawal and refunds</h2>
                    <p className={styles.pageText}>
                        If you are a consumer in the European Union, you can withdraw from a subscription paid through
                        Stripe within 14 days of buying it, without giving a reason. When you subscribe, you ask for
                        the Cloud plan to start immediately, so withdrawing entitles you to a refund of the amount paid
                        minus the days already used, the current day included.
                    </p>
                    <p className={styles.pageText}>
                        To withdraw, use the <b>Withdraw from contract</b> button on your subscription, in your
                        account settings, which is shown throughout the 14 days, then confirm. Your plan ends at once,
                        and we send an acknowledgment to your e-mail address. You can also send us a clear statement at{" "}
                        <a href="mailto:contact@scenarly.com">contact@scenarly.com</a>, for example: “I hereby give
                        notice that I withdraw from my contract for the Scenarly Cloud plan, subscribed on [date],
                        with the account [e-mail address].” We refund you within 14 days, using the payment method you
                        used.
                    </p>
                    <p className={styles.pageText}>
                        Purchases made through the App Store, including their right of withdrawal, are handled by
                        Apple under Apple’s Media Services Terms and Conditions, from your Apple Account purchase
                        history or reportaproblem.apple.com. We cannot issue refunds for them ourselves.
                    </p>
                    <p className={styles.pageText}>
                        Apart from these cases and those in section 17, periods already started are not refunded,
                        unless the law requires it.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>11. Software licence</h2>
                    <p className={styles.pageText}>
                        The Services, including their software, design, texts and the Scenarly® name and logo, belong
                        to us or to our licensors. We grant you a personal, non-exclusive, non-transferable and
                        revocable licence to use the Services and to install the Apps on devices you own or control,
                        in line with these Terms. You may use Scenarly for personal or professional writing, including
                        work that you sell or are paid for.
                    </p>
                    <p className={styles.pageText}>
                        The source code of Scenarly may be published for transparency. Being able to read it does not
                        give you the right to copy, modify or redistribute it, except as its licence allows. Except as
                        permitted by law (in particular for interoperability), you may not decompile, reverse engineer
                        or modify the Apps, or remove any proprietary notice from them.
                    </p>
                    <p className={styles.pageText}>
                        The Apps include open-source components, and some optional features download extra resources
                        to your device (such as read-aloud voice models or spell-check dictionaries). These are
                        subject to their own licences. The Apps may update automatically.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>12. Apps from an app store</h2>
                    <p className={styles.pageText}>
                        If you downloaded an App from the App Store, the Microsoft Store or Google Play (each an “App
                        Distributor”):
                    </p>
                    <ul>
                        <li className={styles.pageText}>
                            these Terms are between you and us, not the App Distributor, and we alone are responsible
                            for the App and its content;
                        </li>
                        <li className={styles.pageText}>
                            the App Distributor has no obligation to provide maintenance or support for the App;
                        </li>
                        <li className={styles.pageText}>
                            if the App fails to conform to an applicable warranty, you may notify the App Distributor,
                            which may refund the purchase price, if any, and it has no other warranty obligation for
                            the App to the extent permitted by law;
                        </li>
                        <li className={styles.pageText}>
                            we, not the App Distributor, handle any claim relating to the App, including product
                            liability, legal or regulatory compliance, consumer protection and intellectual property
                            claims;
                        </li>
                        <li className={styles.pageText}>
                            you confirm that you are not located in a country subject to a US government embargo or
                            designated by the US government as a “terrorist supporting” country, and that you are not
                            on any US government list of prohibited or restricted parties;
                        </li>
                        <li className={styles.pageText}>
                            you must also comply with the App Distributor’s terms of service;
                        </li>
                        <li className={styles.pageText}>
                            the App Distributor and its subsidiaries are third-party beneficiaries of these Terms and
                            may enforce them against you.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>13. Acceptable use</h2>
                    <p className={styles.pageText}>When using the Services, you agree not to:</p>
                    <ul>
                        <li className={styles.pageText}>break the law, or help anyone else do so;</li>
                        <li className={styles.pageText}>
                            upload content that infringes someone else’s rights, or content that is illegal,
                            harassing, hateful, or that sexualises minors;
                        </li>
                        <li className={styles.pageText}>
                            harass, threaten or impersonate other members, other people or our team;
                        </li>
                        <li className={styles.pageText}>
                            get around the limits of the Services, such as storage limits, plan restrictions or the
                            Coverage ticket rules, including by using several accounts, or manipulate upvotes;
                        </li>
                        <li className={styles.pageText}>
                            copy, scrape or collect content from the Community by automated means, including to build
                            datasets or to train AI models;
                        </li>
                        <li className={styles.pageText}>
                            use the Community for advertising, spam or unsolicited promotion;
                        </li>
                        <li className={styles.pageText}>
                            upload viruses or malicious code, probe or attack our systems, or overload or disrupt the
                            Services;
                        </li>
                        <li className={styles.pageText}>
                            access other people’s projects or accounts without permission, or bypass our security
                            measures;
                        </li>
                        <li className={styles.pageText}>
                            resell, rent or share access to a paid plan outside the collaboration features we provide.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>14. Third-party services</h2>
                    <p className={styles.pageText}>
                        Some features rely on third parties, such as Apple and Google for signing in, Stripe and Apple
                        for payments, and the app stores for distributing the Apps. Their own terms and privacy
                        policies apply to what they do. The Services may also link to third-party websites, which we
                        do not control and are not responsible for.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>15. Privacy</h2>
                    <p className={styles.pageText}>
                        Our <a href="/privacy">Privacy Policy</a> explains how we collect and use personal data and
                        where it is hosted. It forms part of these Terms.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>16. Changes to the Services and availability</h2>
                    <p className={styles.pageText}>
                        We improve Scenarly continuously and may add, change or remove features. We will not
                        substantially reduce what a paid plan includes during a period you have already paid for. If
                        we must, we will tell you in advance, and you can cancel and receive a refund for the
                        remaining time.
                    </p>
                    <p className={styles.pageText}>
                        We aim to keep the Services available, but interruptions can happen for maintenance, updates
                        or reasons beyond our control. Local projects remain usable offline during an interruption.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>17. Suspension and termination</h2>
                    <p className={styles.pageText}>
                        You can stop using the Services at any time, and delete your account from your profile in the
                        app.
                    </p>
                    <p className={styles.pageText}>
                        We may suspend or close your account, or your access to part of the Services such as the
                        Community, if you seriously or repeatedly break these Terms, or if the law requires us to. We
                        will tell you why and, unless the breach is urgent or illegal, give you notice and a chance to
                        respond first. If your account is closed for a breach, you may not create a new one without
                        our permission. If we close your account without any fault on your part, we will refund the
                        unused part of your subscription.
                    </p>
                    <p className={styles.pageText}>
                        If we ever discontinue the Services, we will tell you at least 60 days in advance so you can
                        export your cloud projects, and refund any unused part of your subscription.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>18. Warranties</h2>
                    <p className={styles.pageText}>
                        If you are a consumer in the European Union, you benefit from the legal guarantee of
                        conformity for digital content and digital services (in France, articles L.224-25-12 and
                        following of the Consumer Code). Apart from these mandatory guarantees, and to the extent the
                        law allows, the Services are provided “as is”, and we do not guarantee that they will be free
                        of errors or suit every particular need.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>19. Liability</h2>
                    <p className={styles.pageText}>
                        Nothing in these Terms limits our liability for death or personal injury, for fraud, for gross
                        negligence, or where the law does not allow it to be limited.
                    </p>
                    <p className={styles.pageText}>
                        If you are a consumer, we are liable for foreseeable damage caused by our breach of these
                        Terms. We are not liable for damage you cause yourself, for the loss of local projects stored
                        only on your device, for the actions of other members or of third parties, or for events
                        beyond our reasonable control.
                    </p>
                    <p className={styles.pageText}>
                        If you use the Services for your business, and to the extent the law allows, we are not liable
                        for indirect loss such as loss of profit, revenue or opportunity, and our total liability is
                        limited to the amounts you paid us in the 12 months before the event giving rise to the
                        claim.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>20. Your responsibility</h2>
                    <p className={styles.pageText}>
                        You are responsible for the consequences of Your Content and of your breaches of these Terms.
                        If you use the Services for your business, you will compensate us for any claim brought by a
                        third party against us because of Your Content or of such a breach, including reasonable legal
                        costs.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>21. Changes to these Terms</h2>
                    <p className={styles.pageText}>
                        We may update these Terms, for example to reflect new features or changes in the law, and we
                        will update the “Last updated” date above. If a change materially affects your rights or a
                        paid plan, we will tell you by e-mail or in the app at least 30 days before it takes effect.
                        If you do not agree, you can cancel your subscription and stop using the Services before then.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>22. Governing law and disputes</h2>
                    <p className={styles.pageText}>
                        These Terms are governed by French law. If you are a consumer living in another country, you
                        also keep the protection of the mandatory rules of the law of that country.
                    </p>
                    <p className={styles.pageText}>
                        If you have a complaint, please contact us first at{" "}
                        <a href="mailto:contact@scenarly.com">contact@scenarly.com</a>. We will try to resolve it
                        within 30 days. If you are a consumer and we cannot agree, you may refer the dispute free of
                        charge to the consumer mediator [mediator name and website], or go to court. Consumers may
                        bring a claim before the courts provided for by law, including those of the place where they
                        live. For business users, the courts of Paris, France have exclusive jurisdiction.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>23. Electronic communications</h2>
                    <p className={styles.pageText}>
                        You agree that we may send you notices, receipts and other communications by e-mail or in the
                        app, and that these satisfy any legal requirement for written communication.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>24. California users</h2>
                    <p className={styles.pageText}>
                        If a complaint with us is not satisfactorily resolved, you can contact the Complaint
                        Assistance Unit of the Division of Consumer Services of the California Department of Consumer
                        Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834, or
                        by telephone at (800) 952-5210 or (916) 445-1254.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>25. Miscellaneous</h2>
                    <p className={styles.pageText}>
                        These Terms and the Privacy Policy are the entire agreement between you and us about the
                        Services. If any part of them is found invalid, the rest remains in force. Not enforcing a
                        right does not mean we waive it. We may transfer these Terms to a successor of the business,
                        and we will tell you if we do; your rights under them will not be reduced. You may not
                        transfer your rights under these Terms without our agreement. These Terms are written in
                        English; where a translation exists and the law of your country requires it, that translation
                        prevails.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>26. Contact</h2>
                    <p className={styles.pageText}>
                        Hugo Bois EI, Arko Logic (Scenarly)
                        <br />
                        SIREN 994 900 512
                        <br />
                        46 rue de la Saussière, 92100 Boulogne-Billancourt, France
                        <br />
                        <a href="mailto:contact@scenarly.com">contact@scenarly.com</a>
                    </p>
                </section>
            </div>
            <Footer />
        </div>
    );
}
