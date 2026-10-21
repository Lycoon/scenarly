import prisma from "../db";

export interface SignInCodeCreation {
    email: string;
    codeHash: string;
    expiresAt: Date;
    inviteToken: string | null;
}

export class SignInCodeRepository {
    deleteCreatedBefore(cutoff: Date) {
        return prisma.signInCode.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }

    countSince(email: string, since: Date) {
        return prisma.signInCode.count({ where: { email, createdAt: { gte: since } } });
    }

    async countWrongGuessesSince(email: string, since: Date) {
        const { _sum } = await prisma.signInCode.aggregate({
            where: { email, createdAt: { gte: since } },
            _sum: { attempts: true },
        });
        return _sum.attempts ?? 0;
    }

    create(data: SignInCodeCreation) {
        return prisma.signInCode.create({ data });
    }

    findLatest(email: string) {
        return prisma.signInCode.findFirst({ where: { email }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    }

    /** Count one guess against a live code; 0 when it is used up, spent or gone. */
    reserveAttempt(id: number, maxAttempts: number) {
        return prisma.signInCode.updateMany({
            where: { id, usedAt: null, attempts: { lt: maxAttempts } },
            data: { attempts: { increment: 1 } },
        });
    }

    /** Mark the code used, giving back the guess that turned out right; 0 when another request got there first. */
    claim(id: number) {
        return prisma.signInCode.updateMany({
            where: { id, usedAt: null },
            data: { usedAt: new Date(), attempts: { decrement: 1 } },
        });
    }

    deleteByEmail(email: string) {
        return prisma.signInCode.deleteMany({ where: { email } });
    }
}
