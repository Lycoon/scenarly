/**
 * Account deletion.
 *
 * Removes everything attached to a user, in an order that never strands data:
 *  1. projects they OWN — Durable Object room, R2 snapshots, R2 assets/poster,
 *     DB rows. Nobody else can delete these afterwards (deletion needs the
 *     OWNER membership), so they must go before the account does.
 *  2. projects they merely collaborate on — a room blacklist so a live socket
 *     is dropped instead of editing on with credentials that outlive the
 *     account (the membership row itself cascades in step 4).
 *  3. rows keyed by email rather than by a FK to User (magic-link tokens,
 *     Auth.js verification tokens, pending invitations addressed to them).
 *     None of these can be a foreign key: all three are written for addresses
 *     that have no account yet — sign-up links and invitations to strangers.
 *  4. Community files and caches the cascade cannot reach (R2 objects of their
 *     submissions, a claim in flight, unsent drafts, upvote counts, Showcase
 *     pages) — see community-account-service.
 *  5. the User row itself, which cascades Account, Session, the remaining
 *     ProjectMember rows and every Community row.
 *
 * External cleanup (Cloudflare, Stripe) is best-effort: it is logged on
 * failure but never blocks the deletion, otherwise a Worker outage would leave
 * the user unable to delete their account at all.
 */

import * as CollabUtils from "@src/lib/cloud/utils";
import * as CommunityAccountService from "@src/server/service/community-account-service";
import * as S3 from "@src/lib/s3";
import * as MagicLinkService from "@src/server/service/magic-link-service";
import * as ProjectService from "@src/server/service/project-service";
import * as UserService from "@src/server/service/user-service";
import * as SubscriptionService from "@src/server/service/subscription-service";
import { destroyProjectCompletely } from "@src/server/service/project-teardown-service";
import { ProjectRole } from "@src/generated/client/client";
import { logger } from "@src/lib/utils/logger";

export async function deleteAccount(userId: string): Promise<boolean> {
    const user = await UserService.getUserFromId(userId);
    if (!user) return false;

    const memberships = await ProjectService.getMembershipsForTeardown(userId);

    for (const membership of memberships) {
        if (membership.role === ProjectRole.OWNER) {
            await destroyProjectCompletely(membership.projectId);
        } else {
            // Blacklisting leaves the user id in that room's storage on
            // purpose: their cloud token stays valid for up to an hour, and
            // the WebSocket upgrade only checks the token — without the
            // blacklist a deleted account could reconnect and keep editing.
            await CollabUtils.blacklistFromWebsocket(userId, membership.projectId);
        }
    }

    try {
        await SubscriptionService.cancelAllForDeletion(userId);
    } catch (e) {
        logger.error("[AccountDeletion] Failed to cancel Stripe subscription", { userId, error: e });
    }

    await Promise.all([
        MagicLinkService.deleteForEmail(user.email),
        UserService.deleteVerificationTokens(user.email),
        ProjectService.deleteInvitesByEmail(user.email),
        // Any GDPR export zip still sitting in R2 (best-effort, logged inside).
        S3.destroyPrefix(`gdpr-exports/${userId}/`),
    ]);

    try {
        await CommunityAccountService.prepareAccountDeletion(userId);
    } catch (e) {
        logger.error("[AccountDeletion] Community cleanup failed", { userId, error: e });
    }

    await UserService.deleteUserFromId(userId);
    logger.info("[AccountDeletion] Deleted account", { userId, projects: memberships.length });

    return true;
}
