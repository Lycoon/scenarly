import { CommunityCreditReason, Prisma } from "../../generated/client/client";
import prisma from "../db";

/** Either the singleton client or the client of an interactive transaction. */
export type Db = Prisma.TransactionClient;

export class CommunityProfileRepository {
    findByUserId(userId: string, db: Db = prisma) {
        return db.communityProfile.findUnique({ where: { userId } });
    }

    create(userId: string, penName: string, db: Db = prisma) {
        return db.communityProfile.create({ data: { userId, penName } });
    }

    updatePenName(userId: string, penName: string) {
        return prisma.communityProfile.update({ where: { userId }, data: { penName } });
    }

    /**
     * Serialise every credit movement of one user: a row lock on the profile
     * held until the surrounding transaction commits. Two concurrent charges
     * then read the ledger one after the other and the second sees the first.
     */
    async lock(userId: string, db: Db): Promise<void> {
        await db.$queryRaw`SELECT "userId" FROM "CommunityProfile" WHERE "userId" = ${userId} FOR UPDATE`;
    }

    async balance(userId: string, db: Db = prisma): Promise<number> {
        const agg = await db.communityCreditEntry.aggregate({ where: { userId }, _sum: { delta: true } });
        return agg._sum.delta ?? 0;
    }

    /** Append a ledger row. Throws P2002 if `(userId, reason, refId)` already exists. */
    appendCredit(userId: string, delta: number, reason: CommunityCreditReason, refId: string, db: Db = prisma) {
        return db.communityCreditEntry.create({ data: { userId, delta, reason, refId } });
    }

    hasCredit(userId: string, reason: CommunityCreditReason, refId: string, db: Db = prisma) {
        return db.communityCreditEntry.findUnique({ where: { userId_reason_refId: { userId, reason, refId } } });
    }

    listCredits(userId: string, take: number, cursor?: string) {
        return prisma.communityCreditEntry.findMany({
            where: { userId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });
    }

    /** Set the active claim only if none is held. Returns the number of rows updated (0 = conflict). */
    async setActiveClaim(userId: string, claimId: string, db: Db = prisma): Promise<number> {
        const res = await db.communityProfile.updateMany({
            where: { userId, activeClaimId: null },
            data: { activeClaimId: claimId },
        });
        return res.count;
    }

    /** Clear the active claim if it is the given one (a no-op otherwise). */
    clearActiveClaim(userId: string, claimId: string, db: Db = prisma) {
        return db.communityProfile.updateMany({
            where: { userId, activeClaimId: claimId },
            data: { activeClaimId: null },
        });
    }

    incrementReviewsCompleted(userId: string, db: Db = prisma) {
        return db.communityProfile.update({
            where: { userId },
            data: { reviewsCompleted: { increment: 1 } },
        });
    }

    incrementRating(userId: string, useful: boolean, db: Db = prisma) {
        return db.communityProfile.update({
            where: { userId },
            data: useful ? { usefulCount: { increment: 1 } } : { notUsefulCount: { increment: 1 } },
        });
    }

    setLastReshuffle(userId: string, at: Date, db: Db = prisma) {
        return db.communityProfile.update({ where: { userId }, data: { lastReshuffleAt: at } });
    }
}
