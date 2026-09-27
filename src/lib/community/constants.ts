/**
 * Community (Coverage + Showcase) tunables.
 *
 * Shared by the client (form validation, countdowns, copy) and the server
 * (the source of truth). Plain constants — tune here. The ticket economy is
 * closed on purpose: the only mints are the one-time starter grant and a
 * completed review, so every submission is backed by roughly three reviews.
 */

import type { CommunityFormat } from "@src/generated/client/browser";

/** Tickets a submission uses. */
export const SUBMISSION_COST = 3;
/** Tickets a completed review earns. */
export const REVIEW_REWARD = 1;
/** Tickets granted once, at join. */
export const STARTER_TICKETS = 3;

/** Scripts shown per offer set. */
export const OFFER_SIZE = 5;
/** One free reshuffle of the offer set per day. */
export const RESHUFFLE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** A review cannot be submitted before this long after the claim. */
export const CLAIM_FLOOR_MS = 7 * 24 * 60 * 60 * 1000;
/** An unsubmitted claim expires this long after the claim. */
export const CLAIM_DEADLINE_MS = 21 * 24 * 60 * 60 * 1000;
/** Deadline reminder email lead time. */
export const CLAIM_REMINDER_LEAD_MS = 48 * 60 * 60 * 1000;

/** "One month" in the pool, fixed at submission as `poolExitAt`. */
export const POOL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Reviews a submission needs before it may leave the pool. */
export const MIN_COMPLETED_REVIEWS = 3;

/** Verified email must be at least this old to submit to Coverage. */
export const ENTRY_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Hard cap on an uploaded screenplay PDF. */
export const MAX_PDF_BYTES = 25 * 1024 ** 2; // 25 MB

/**
 * Coverage takes feature-length screenplays only, so every submission asks
 * reviewers for comparable work and every review earns the same ticket.
 * Shorts, pilots and the rest can still go to Showcase.
 */
export const COVERAGE_FORMAT: CommunityFormat = "FEATURE";
export const COVERAGE_PAGE_BOUNDS = { min: 60, max: 240 };

/** Page-count bounds per format for Showcase-only uploads. */
export const PAGE_BOUNDS: Record<CommunityFormat, { min: number; max: number }> = {
    FEATURE: { min: 60, max: 240 },
    PILOT: { min: 20, max: 75 },
    SHORT: { min: 3, max: 45 },
    OTHER: { min: 3, max: 240 },
};

/** Minimum words across the three review sections combined. */
export const MIN_REVIEW_WORDS = 300;

export const TITLE_MAX_LENGTH = 120;
export const LOGLINE_MIN_LENGTH = 40;
export const LOGLINE_MAX_LENGTH = 800;
export const GENRES_MIN = 1;
export const GENRES_MAX = 3;

/** Lifetime of a presigned PDF URL. */
export const PRESIGN_TTL_S = 300;

/** Entries per page of the Showcase wall. */
export const SHOWCASE_PAGE_SIZE = 24;
/**
 * How fast an entry sinks on the Top sort: score = (upvotes + 1) / (hours + 2)^gravity.
 * Higher sinks faster; 1.4 keeps a well-liked script on the first page for days, not weeks.
 */
export const SHOWCASE_GRAVITY = 1.4;

/** R2 key of a submission's frozen PDF. */
export const submissionObjectKey = (submissionId: string) => `community/${submissionId}/original.pdf`;
/** R2 key of a reviewer's watermarked copy. */
export const claimObjectKey = (submissionId: string, claimId: string) =>
    `community/${submissionId}/claims/${claimId}.pdf`;
/** R2 prefix holding everything a submission ever stored. */
export const submissionObjectPrefix = (submissionId: string) => `community/${submissionId}/`;

/**
 * Where the desktop and mobile apps send the user for Community: the web app,
 * since the Tauri build is a static export without these pages.
 */
export const COMMUNITY_WEB_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "https://scenarly.com"}/community`;
