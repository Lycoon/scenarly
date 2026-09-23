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
