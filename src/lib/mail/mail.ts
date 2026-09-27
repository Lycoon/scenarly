import nodemailer from "nodemailer";
import * as fs from "fs";
import { BASE_URL } from "../utils/constants";
import hogan from "hogan.js";

const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_SECRET,
    },
});

export const sendProjectInviteEmail = async (email: string, projectTitle: string, token: string) => {
    const link = `${BASE_URL}/api/projects/accept-invite?token=${token}`;
    const content = `You have been invited to join project '${projectTitle}' as a collaborator. Click the button below to accept the invite.`;

    sendFormattedEmail(email, "Project Invitation", "Project Invitation", content, "Join project", link);
};

/**
 * Notification only — deliberately carries no download link. The archive is
 * fetched from the account settings by the signed-in user, so this mail is
 * worth nothing to anyone who intercepts it, and it lets the account holder
 * spot an export they never asked for.
 */
export const sendDataExportEmail = async (email: string) => {
    const content = `Your personal data export is ready. Open Scenarly and go to Settings → Account → Profile to download the archive containing your account information and project memberships. You have 7 days to download it. If you did not request this export, someone may have access to your account — change how you sign in and contact us.`;

    sendFormattedEmail(email, "Your data export", "Your data export is ready", content, "Open Scenarly", BASE_URL);
};

export const sendMagicLinkEmail = async (email: string, token: string) => {
    const link = `${BASE_URL}/auth/magic-link?token=${token}`;
    const content = `Click the button below to sign in to your Scenarly account. This link will expire in 10 minutes and can only be used once. If you didn't request this, you can safely ignore this email.`;

    sendFormattedEmail(email, "Sign in to Scenarly", "Your sign-in link", content, "Sign in", link);
};

/** Coverage: a review landed on the author's submission. Carries no review text. */
export const sendReviewReceivedEmail = async (email: string, submissionTitle: string, submissionId: string) => {
    const link = `${BASE_URL}/community/submissions/${submissionId}`;
    const content = `A new review of '${submissionTitle}' has arrived on Coverage. Read it, then tell the reviewer whether it was useful — that is what keeps the exchange honest.`;

    sendFormattedEmail(email, "New review", "You received a review", content, "Read the review", link);
};

/** Coverage: the reviewer's claim expires in about two days. */
export const sendClaimExpiringEmail = async (email: string, submissionTitle: string, deadline: Date) => {
    const link = `${BASE_URL}/community/coverage/review`;
    const content = `Your review of '${submissionTitle}' is due on ${deadline.toUTCString()}. Submit it before then to earn your ticket; after the deadline the claim expires and this script cannot be claimed again.`;

    sendFormattedEmail(email, "Review due soon", "Your review is due soon", content, "Finish the review", link);
};

/** Coverage: a saved draft was sent automatically once the 7-day floor passed. */
export const sendDraftAutoSubmittedEmail = async (email: string, submissionTitle: string) => {
    const link = `${BASE_URL}/community/coverage`;
    const content = `Your saved review of '${submissionTitle}' was sent to its author now that the 7-day waiting period is over, and your ticket has been added. You can pick another script whenever you like.`;

    sendFormattedEmail(email, "Review sent", "Your review was sent", content, "Open Coverage", link);
};

const TERMS_URL = `${process.env.NEXT_PUBLIC_API_URL || "https://scenarly.com"}/terms`;

/** "1 October 2026": dates in these mails are days, counted in UTC like the server does. */
const formatDay = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Confirmation of a Stripe subscription, which the law requires on a durable
 * medium after the purchase: what was bought, how it renews and ends, and the
 * right of withdrawal with its deadline. App Store purchases are confirmed by Apple.
 */
export const sendSubscriptionConfirmationEmail = async (
    email: string,
    details: { planName: string; price: string; period: "month" | "year"; renewsOn: Date; withdrawUntil: Date },
) => {
    const { planName, price, period, renewsOn, withdrawUntil } = details;
    const content = [
        `Thank you for subscribing to Scenarly ${planName}. Your subscription is active.`,
        `Price: ${price} per ${period}, paid today. It renews automatically on ${formatDay(renewsOn)} and every ${period} after that, until you cancel it. You can cancel at any time from your account settings in Scenarly; the plan then stays active until the end of the period you paid for.`,
        `Right of withdrawal: if you are a consumer in the European Union, you can withdraw from this subscription until ${formatDay(withdrawUntil)} included, without giving a reason, with the "Withdraw from contract" button in your account settings or by writing to contact@scenarly.com. As you asked for ${planName} to start immediately, you are then refunded the amount paid minus the days already used.`,
        `Seller: Hugo Bois EI (Arko Logic), 46 rue de la Saussière, 92100 Boulogne-Billancourt, France. SIREN 994 900 512. Your receipt and invoice come in a separate email. The Terms of Service you accepted are at ${TERMS_URL}.`,
    ].join("\n\n");

    sendFormattedEmail(email, "Welcome to " + planName, `Your Scenarly ${planName} subscription`, content, "Read the Terms of Service", TERMS_URL);
};

/**
 * Confirmation of a cancellation made in the app, which the law requires
 * (Code de la consommation, L.215-1-1): when the contract ends and what that
 * changes. `withdrawUntil` is set while the withdrawal period is still open.
 */
export const sendCancellationConfirmationEmail = async (
    email: string,
    details: { planName: string; at: Date; endsOn: Date; withdrawUntil: Date | null },
) => {
    const { planName, at, endsOn, withdrawUntil } = details;
    const content = [
        `We received the cancellation of your Scenarly ${planName} subscription on ${at.toUTCString()}. It will not renew, and nothing more will be charged.`,
        `${planName} stays active until ${formatDay(endsOn)}. After that, the features that need it stop working, such as creating cloud projects, uploading to cloud storage, saving named versions and inviting collaborators. Your cloud projects are not deleted and you can still export them. You can reactivate the subscription from your account settings until then.`,
        ...(withdrawUntil
            ? [
                  `You can also still withdraw until ${formatDay(withdrawUntil)} included: ${planName} would then end right away and the unused days would be refunded.`,
              ]
            : []),
    ].join("\n\n");

    sendFormattedEmail(email, "Subscription cancelled", "Your cancellation is confirmed", content, "Open Scenarly", BASE_URL);
};

/** A Stripe subscription ended with the account it belonged to. */
export const sendDeletionCancellationEmail = async (email: string, planName: string, at: Date) => {
    const content = `Your Scenarly account was deleted on ${at.toUTCString()}, and with it your Scenarly ${planName} subscription ended. It will not renew and nothing more will be charged. As stated when you deleted your account, the rest of the period already paid is not refunded.`;

    sendFormattedEmail(email, "Subscription ended", "Your subscription has ended", content, "Visit Scenarly", BASE_URL);
};

/**
 * Acknowledgment of a withdrawal, which the law requires on a durable medium
 * without delay: it names the contract and the date and time it was received.
 */
export const sendWithdrawalConfirmationEmail = async (email: string, planName: string, at: Date, refund: string) => {
    const content = `We received your withdrawal from your Scenarly ${planName} subscription on ${at.toUTCString()}. Your subscription has ended and will not renew. ${refund} will be refunded to your original payment method within 14 days, usually within 5 to 10 business days. Keep this email as the acknowledgment of your withdrawal.`;

    sendFormattedEmail(email, "Withdrawal confirmed", "Your withdrawal is confirmed", content, "Open Scenarly", BASE_URL);
};

/** Something support has to finish by hand. */
export const sendInternalAlertEmail = async (subject: string, text: string) => {
    transporter.sendMail({
        from: "Scenarly <no-reply@scenarly.com>",
        to: "contact@scenarly.com",
        subject: `[Alert] ${subject}`,
        text,
    });
};

const sendFormattedEmail = async (
    email: string,
    welcomeMessage: string,
    subject: string,
    bodyText: string,
    buttonText: string,
    link: string,
) => {
    const template = fs.readFileSync("./src/lib/mail/template.html").toString();
    const signature = fs.readFileSync("./src/lib/mail/signature.html").toString();
    const compiled = hogan.compile(template);
    const rendered = compiled.render({
        bodyText,
        buttonText,
        welcomeMessage,
        link,
        signature,
    });

    sendEmail(email, subject, rendered, bodyText);
};

export const sendContactEmail = async (email: string, reason: string, message: string) => {
    const html = `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
    `;
    const text = `From: ${email}\nReason: ${reason}\nMessage:\n${message}`;
    transporter.sendMail({
        from: "Scenarly Form <no-reply@scenarly.com>",
        replyTo: email,
        to: "contact@scenarly.com",
        subject: `[Contact] ${reason}`,
        html,
        text,
    });
};

const sendEmail = async (to: string, subject: string, html: string, text: string) => {
    transporter.sendMail({
        from: "Scenarly <no-reply@scenarly.com>",
        to,
        subject,
        html: html,
        text: text,
    });
};
