/**
 * Email sign-in by 6-digit code: the code is typed into the page or app that
 * asked for it, which then gets its session straight from the verify route.
 *
 * A code is far easier to guess than a link token, so guessing is bounded:
 * only an address's newest code works, it dies after MAX_ATTEMPTS_PER_CODE
 * wrong guesses, and an address takes at most MAX_WRONG_GUESSES_PER_DAY a
 * day — one chance in 50,000 a day for someone guessing without pause.
 * Every response is the same whether or not the address has an account.
 */

import crypto from "crypto";
import { SignInCodeRepository } from "../repository/sign-in-code-repository";
import * as SecretService from "@src/lib/utils/secrets";
import * as Mail from "@src/lib/mail/mail";
import { AppError } from "@src/lib/utils/api-utils";
import { SIGN_IN_CODE_PATTERN, SignInCodeError } from "@src/lib/utils/api-bodies";
import { logger } from "@src/lib/utils/logger";
import { isEmailAllowed } from "@src/lib/access-allowlist";

const repository = new SignInCodeRepository();

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const CODE_TTL_MINUTES = 10;
const REQUEST_WINDOW_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_WRONG_GUESSES_PER_DAY = 20;

const throttled = () =>
    new AppError(429, "Too many codes requested for this address. Please wait a few minutes.", SignInCodeError.THROTTLED);
const locked = () =>
    new AppError(429, "Too many wrong codes for this address. Please try again tomorrow.", SignInCodeError.LOCKED);
const invalid = () => new AppError(422, "This code is not right.", SignInCodeError.INVALID);
const expired = () => new AppError(422, "This code has expired. Please request a new one.", SignInCodeError.EXPIRED);
const notAllowed = () =>
    new AppError(403, "This address does not have access to this environment.", SignInCodeError.NOT_ALLOWED);

/**
 * The code of the accounts the app stores' reviewers sign in with, when
 * `email` is one of them (`REVIEW_ACCOUNT_EMAIL` is comma-separated, one
 * account per store whose review needs a different plan): it never changes
 * and is never emailed, so no mailbox has to exist. Both values live in the
 * server environment only — the source shows how it works, never how to get
 * in — and unset, it is off. The usual guessing limits still apply.
 */
function reviewCodeFor(email: string): string | null {
    const reviewEmails = (process.env.REVIEW_ACCOUNT_EMAIL ?? "").split(",").map((entry) => entry.toLowerCase().trim());
    const reviewCode = process.env.REVIEW_ACCOUNT_CODE;
    if (!reviewCode || !reviewEmails.includes(email)) return null;
    if (!SIGN_IN_CODE_PATTERN.test(reviewCode)) {
        logger.error("[SignInCode] REVIEW_ACCOUNT_CODE must be 6 digits; emailing a code instead");
        return null;
    }
    return reviewCode;
}

/** Issue a new code for `email` and mail it. `inviteToken` is accepted once the code is. */
export async function sendCode(email: string, inviteToken: string | null): Promise<void> {
    // A restricted environment (staging) names its allowlist openly: it only
    // serves the team, so saying who is in costs nothing and saves confusion.
    if (!isEmailAllowed(email)) throw notAllowed();

    const now = Date.now();
    // Kept a day, not just until expiry, so today's wrong guesses still count.
    await repository.deleteCreatedBefore(new Date(now - DAY_MS));

    if ((await repository.countSince(email, new Date(now - REQUEST_WINDOW_MINUTES * MINUTE_MS))) >= MAX_REQUESTS_PER_WINDOW) {
        throw throttled();
    }

    const reviewCode = reviewCodeFor(email);
    const code = reviewCode ?? crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    await repository.create({
        email,
        codeHash: SecretService.hashToken(code),
        expiresAt: new Date(now + CODE_TTL_MINUTES * MINUTE_MS),
        inviteToken,
    });
    if (reviewCode) return;

    // Never block the response on SMTP, nor tell the caller it failed: that
    // would say whether the address exists.
    Mail.sendSignInCodeEmail(email, code).catch((err) => {
        logger.error("[SignInCode] Failed to send the code", { error: err });
    });
}

/** Spend `code` if it is `email`'s newest one; throws an AppError otherwise. */
export async function consumeCode(email: string, code: string): Promise<{ inviteToken: string | null }> {
    if ((await repository.countWrongGuessesSince(email, new Date(Date.now() - DAY_MS))) >= MAX_WRONG_GUESSES_PER_DAY) {
        throw locked();
    }

    const latest = await repository.findLatest(email);
    if (!latest || latest.usedAt || latest.expiresAt <= new Date()) throw expired();

    // Counted before comparing, so guesses sent in parallel cannot overrun the limit.
    if ((await repository.reserveAttempt(latest.id, MAX_ATTEMPTS_PER_CODE)).count === 0) throw expired();

    // Both are hex SHA-256 digests, so always the same length.
    const given = new Uint8Array(Buffer.from(SecretService.hashToken(code)));
    if (!crypto.timingSafeEqual(given, new Uint8Array(Buffer.from(latest.codeHash)))) {
        throw latest.attempts + 1 >= MAX_ATTEMPTS_PER_CODE ? expired() : invalid();
    }

    if ((await repository.claim(latest.id)).count === 0) throw expired();
    return { inviteToken: latest.inviteToken };
}

export const deleteForEmail = (email: string) => repository.deleteByEmail(email);
