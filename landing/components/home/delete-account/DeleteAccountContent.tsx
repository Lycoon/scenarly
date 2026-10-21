"use client";

import Link from "next/link";

import styles from "../Landing.module.css";
import Footer from "../Footer";

// Linked from the Google Play listing ("Delete account URL" in Data safety): it must name the app
// and the developer shown on the listing, show the steps prominently, and say what is deleted, what
// is kept and for how long. Keep it in step with account-deletion-service.ts.

export default function DeleteAccountContent() {
    return (
        <div className={styles.pageWrapper}>
            <div className={styles.gradientBackground}></div>
            <div className={styles.pageContainer}>
                <h1 className={styles.pageTitle}>Delete your Scenarly® account or data</h1>

                <section>
                    <p className={styles.pageText}>
                        This page explains how to delete your account in <b>Scenarly®</b>, the screenwriting app
                        published by <b>Arko Logic</b>, or only part of your data while keeping your account. It
                        applies to every version of Scenarly®: Android, iOS, desktop and web.
                    </p>
                    <p className={styles.pageText}>
                        Signing in is optional. If you have never signed in, we hold no data about you: your projects
                        live only on your device, and uninstalling the app or clearing its data deletes them.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Delete your account from the app</h2>
                    <ol>
                        <li className={styles.pageText}>Open Scenarly® and sign in to the account to delete.</li>
                        <li className={styles.pageText}>
                            Open <b>Settings</b>, then <b>Account</b> → <b>Profile</b>.
                        </li>
                        <li className={styles.pageText}>
                            In <b>Danger zone</b>, tap <b>Delete</b> next to <b>Delete account</b>.
                        </li>
                        <li className={styles.pageText}>
                            Type the confirmation sentence shown on screen, then tap <b>Delete my account</b>.
                        </li>
                    </ol>
                    <p className={styles.pageText}>
                        Your account is deleted immediately. If you want a copy of your data first, use{" "}
                        <b>Export my data</b> in the same section before deleting.
                    </p>
                    <p className={styles.pageText}>
                        A Google Play subscription stops renewing when you delete your account, but the period
                        already paid is not refunded. An App Store subscription can only be cancelled by you, from
                        your Apple ID subscriptions: cancel it before deleting your account.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Delete your account by e-mail</h2>
                    <p className={styles.pageText}>
                        If you cannot open the app or can no longer sign in, write to{" "}
                        <a href="mailto:contact@scenarly.com?subject=Scenarly%20account%20deletion%20request">
                            contact@scenarly.com
                        </a>{" "}
                        from the e-mail address of your account, with the subject “Scenarly account deletion
                        request”. We may ask you to confirm that the account is yours, then delete it and confirm by
                        e-mail within one month at most.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>Delete part of your data and keep your account</h2>
                    <p className={styles.pageText}>You can delete some of your data yourself, at any time:</p>
                    <ul>
                        <li className={styles.pageText}>
                            <b>A cloud project</b> and everything in it (screenplay, boards, notes, images, audio,
                            saved versions): open the project settings, then <b>Delete project</b> in{" "}
                            <b>Danger zone</b>.
                        </li>
                        <li className={styles.pageText}>
                            <b>A project shared with you</b>: leave it from its collaborators settings. Your access
                            and membership are removed.
                        </li>
                        <li className={styles.pageText}>
                            <b>Community submissions and Showcase entries</b>: withdraw them from the Community. The
                            script files are deleted from our storage.
                        </li>
                        <li className={styles.pageText}>
                            <b>Your display name and colour</b>: change them in <b>Settings</b> → <b>Profile</b>.
                        </li>
                    </ul>
                    <p className={styles.pageText}>
                        For any other personal data, write to{" "}
                        <a href="mailto:contact@scenarly.com?subject=Scenarly%20data%20deletion%20request">
                            contact@scenarly.com
                        </a>{" "}
                        from the e-mail address of your account, with the subject “Scenarly data deletion request”,
                        and tell us which data you want deleted. We reply within one month at most.
                    </p>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>What is deleted</h2>
                    <p className={styles.pageText}>When your account is deleted, we delete:</p>
                    <ul>
                        <li className={styles.pageText}>
                            your account: e-mail address, display name, colour, settings, linked Google or Apple
                            sign-in, sessions and sign-in codes;
                        </li>
                        <li className={styles.pageText}>
                            every cloud project you own, for every collaborator: screenplays, boards, notes, images,
                            audio, saved versions and pending invitations;
                        </li>
                        <li className={styles.pageText}>your memberships in projects owned by other people;</li>
                        <li className={styles.pageText}>
                            your subscription records, after cancelling any Stripe subscription and stopping any
                            Google Play renewal;
                        </li>
                        <li className={styles.pageText}>
                            your Community profile, submissions and their files, Showcase entries, upvotes and unsent
                            review drafts;
                        </li>
                        <li className={styles.pageText}>any data export you requested and have not downloaded.</li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.pageSectionTitle}>What is kept, and for how long</h2>
                    <ul>
                        <li className={styles.pageText}>
                            <b>Reviews you sent in the Community</b> stay with the authors who received them,
                            anonymised: they are no longer linked to you in any way. They remain as long as the
                            author keeps them.
                        </li>
                        <li className={styles.pageText}>
                            <b>Images and audio you added to a project owned by someone else</b> stay in that project,
                            which belongs to its owner, so as not to break their work. They are no longer linked to
                            your account.
                        </li>
                        <li className={styles.pageText}>
                            {/* TODO: confirm the backup and log retention periods before publishing. */}
                            <b>Backups and technical logs</b> may still contain your data for up to <b>30 days</b>,
                            after which they are overwritten. They are only used to recover from incidents.
                        </li>
                        <li className={styles.pageText}>
                            <b>Payment records</b> are kept by the payment provider you used (Stripe, Google Play or
                            the App Store), under its own legal obligations, for example tax and accounting rules.
                            We do not hold your card details.
                        </li>
                    </ul>
                    <p className={styles.pageText}>
                        Projects stored only on your device are never sent to us. Uninstalling the app or clearing
                        its data deletes them.
                    </p>
                    <p className={styles.pageText}>
                        For more about how we handle your data, read our <Link href="/privacy">Privacy Policy</Link>.
                    </p>
                </section>
            </div>
            <Footer />
        </div>
    );
}
