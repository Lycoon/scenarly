/**
 * Coverage tickets and membership.
 *
 * Tickets are an append-only ledger (`CommunityTicketEntry`); the balance is
 * its sum, never a column. Every movement runs under the profile's row lock
 * (`CommunityProfileRepository.lock`) inside the caller's transaction, so a
 * charge can never race another charge past zero. The ledger's unique on
 * `(userId, reason, refId)` makes each mint and charge idempotent: retrying a
 * request or re-running a tick posts nothing twice.
 */

import prisma from "@src/server/db";
import * as UserService from "@src/server/service/user-service";
import { ConflictError, InsufficientTicketsError, NotEligibleError, NotFoundError } from "@src/lib/utils/api-utils";
import { getEligibility, type Eligibility } from "@src/lib/community/rules";
import {
    ENTRY_MIN_ACCOUNT_AGE_MS,
    REVIEW_REWARD,
    STARTER_TICKETS,
    SUBMISSION_COST,
} from "@src/lib/community/constants";
import { CommunityTicketReason, Prisma, UserRole } from "@src/generated/client/client";
import { CommunityProfileRepository, type Db } from "../repository/community-profile-repository";

const profiles = new CommunityProfileRepository();

const isUniqueViolation = (e: unknown) =>
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Minimum account age for the entry gate. `COMMUNITY_ENTRY_MIN_AGE_DAYS`
 * overrides the default (7) so staging and local setups can open the gate
 * without touching the rule shipped to production.
 */
const entryMinAgeMs = (): number => {
    const days = Number(process.env.COMMUNITY_ENTRY_MIN_AGE_DAYS);
    return Number.isFinite(days) && process.env.COMMUNITY_ENTRY_MIN_AGE_DAYS !== undefined
        ? days * 24 * 60 * 60 * 1000
        : ENTRY_MIN_ACCOUNT_AGE_MS;
};

/**
 * Entry gate for a user who has not joined yet. Admins skip the account-age
 * rule so the feature can be exercised on a fresh account; the verified-email
 * part still applies to them.
 */
export async function getUserEligibility(userId: string, now = new Date()): Promise<Eligibility> {
    const user = await UserService.getUserFromId(userId);
    if (!user) throw new NotFoundError("User not found");
    const eligibility = getEligibility(user.emailVerified, now, entryMinAgeMs());
    if (!eligibility.ok && eligibility.reason === "TOO_RECENT" && user.role === UserRole.ADMIN) return { ok: true };
    return eligibility;
}

export const getProfile = (userId: string) => profiles.findByUserId(userId);

/** Profile or 404: for routes that need a member. */
export async function requireProfile(userId: string) {
    const profile = await profiles.findByUserId(userId);
    if (!profile) throw new NotFoundError("Join Community first");
    return profile;
}

/**
 * Create the profile and grant the starter tickets in one transaction. A
 * second join is a 409, and the ledger unique means the grant can never
 * happen twice even if the profile row somehow survived a partial failure.
 */
export async function join(userId: string, penName: string, now = new Date()) {
    const eligibility = await getUserEligibility(userId, now);
    if (!eligibility.ok) throw new NotEligibleError();

    try {
        return await prisma.$transaction(async (tx) => {
            const profile = await profiles.create(userId, penName, tx);
            await profiles.appendTicket(userId, STARTER_TICKETS, CommunityTicketReason.STARTER, userId, tx);
            return profile;
        });
    } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictError("Already a member of Community");
        throw e;
    }
}

export const updatePenName = (userId: string, penName: string) => profiles.updatePenName(userId, penName);

export const getBalance = (userId: string) => profiles.balance(userId);

export const listTickets = (userId: string, take = 50, cursor?: string) =>
    profiles.listTickets(userId, take, cursor);

/**
 * Charge a submission inside the caller's transaction. Locks the profile,
 * checks the balance, appends the -3 row. Throws InsufficientTicketsError
 * before writing anything.
 */
export async function chargeSubmission(userId: string, submissionId: string, tx: Db): Promise<void> {
    await profiles.lock(userId, tx);
    const balance = await profiles.balance(userId, tx);
    if (balance < SUBMISSION_COST) throw new InsufficientTicketsError();
    await profiles.appendTicket(userId, -SUBMISSION_COST, CommunityTicketReason.SUBMISSION, submissionId, tx);
}

/** Refund `amount` for a submission; idempotent per submission. */
export async function refundSubmission(userId: string, submissionId: string, amount: number, tx: Db): Promise<void> {
    if (amount <= 0) return;
    await profiles.lock(userId, tx);
    try {
        await profiles.appendTicket(userId, amount, CommunityTicketReason.SUBMISSION_REFUND, submissionId, tx);
    } catch (e) {
        if (!isUniqueViolation(e)) throw e;
    }
}

/** Pay a completed review; idempotent per claim. Returns false if already paid. */
export async function payReview(userId: string, claimId: string, tx: Db): Promise<boolean> {
    await profiles.lock(userId, tx);
    try {
        await profiles.appendTicket(userId, REVIEW_REWARD, CommunityTicketReason.REVIEW_COMPLETED, claimId, tx);
        return true;
    } catch (e) {
        if (isUniqueViolation(e)) return false;
        throw e;
    }
}
