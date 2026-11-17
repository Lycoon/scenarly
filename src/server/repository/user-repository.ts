import { UserSettings } from "@src/lib/utils/types";
import { Prisma } from "../../generated/client/client";
import prisma from "../db";

export type UpdateSettings = {
    highlightOnHover?: boolean;
    sceneBackground?: boolean;
    notesColor?: string;
    exportedNotesColor?: string;
    onlineUsername?: string;
    onlineColor?: string;
};

export interface UserUpdate {
    email?: string;
    emailVerified?: Date | null;
    username?: string;
    color?: string;
    stripeCustomerId?: string | null;
    settings?: Partial<UserSettings>;
}

export interface UserCreation {
    email: string;
}

type idOrEmailType = { id: string } | { email: string };

/** The user as /api/users hands it to the browser — so no store ids, and just
 * enough of each subscription to gate features and render the plan cards. */
const USER_SELECT = {
    id: true,
    email: true,
    emailVerified: true,
    createdAt: true,
    settings: true,
    username: true,
    color: true,
    role: true,
    subscriptions: {
        select: { plan: true, provider: true, expiresAt: true, cancelled: true },
    },
} satisfies Prisma.UserSelect;

export class UserRepository {
    updateUserFromId(userId: string, userUpdate: UserUpdate) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                email: userUpdate.email,
                emailVerified: userUpdate.emailVerified,
                settings: userUpdate.settings as Prisma.InputJsonValue,
                username: userUpdate.username,
                color: userUpdate.color,
                stripeCustomerId: userUpdate.stripeCustomerId,
            },
        });
    }

    createUser(user: UserCreation) {
        return prisma.user.create({
            data: {
                email: user.email,
                emailVerified: new Date(),
            },
            select: USER_SELECT,
        });
    }

    deleteUser(idOrEmail: idOrEmailType) {
        return prisma.user.delete({
            where: idOrEmail,
        });
    }

    /** Auth.js sign-in tokens, keyed by email rather than by a FK to User. */
    deleteVerificationTokens(email: string) {
        return prisma.verificationToken.deleteMany({ where: { identifier: email } });
    }

    fetchUser(idOrEmail: idOrEmailType) {
        return prisma.user.findUnique({
            where: idOrEmail,
            select: USER_SELECT,
        });
    }

    countAll() {
        return prisma.user.count();
    }

    searchUsers(term: string, limit: number, cursor?: number) {
        const where: Prisma.UserWhereInput | undefined = term
            ? (/^[0-9a-f-]{30,}$/i.test(term)
                ? { OR: [{ id: term }, { email: { contains: term, mode: "insensitive" } }] }
                : { email: { contains: term, mode: "insensitive" } })
            : undefined;

        return prisma.user.findMany({
            ...(where && { where }),
            orderBy: { createdAt: "desc" },
            take: limit,
            ...(cursor !== undefined && { skip: cursor }),
            select: {
                id: true,
                email: true,
                createdAt: true,
                role: true,
                subscriptions: { where: { expiresAt: { gt: new Date() } }, select: { plan: true } },
            },
        });
    }

    /** Kept out of fetchUser: that select is what /api/users hands to the browser. */
    fetchStripeCustomerId(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true },
        });
    }

    /** The whole User row, for the GDPR export: unlike USER_SELECT it must carry
     * the store ids too, and with no select a column added later is exported
     * without anyone having to remember this method. Safe because User holds no
     * secrets — OAuth tokens live on Account. */
    fetchUserForExport(userId: string) {
        return prisma.user.findUnique({ where: { id: userId } });
    }

    /** The user a provider identity (`apple` + Apple's `sub`) signs in as. */
    async fetchUserByAccount(provider: string, providerAccountId: string) {
        const account = await prisma.account.findUnique({
            where: { provider_providerAccountId: { provider, providerAccountId } },
            select: { user: { select: USER_SELECT } },
        });
        return account?.user ?? null;
    }

    /** Link a provider identity to a user, as the Auth.js adapter does for a web sign-in. */
    createAccount(userId: string, provider: string, providerAccountId: string) {
        return prisma.account.create({
            data: { userId, provider, providerAccountId, type: "oidc" },
        });
    }

    updateAccountTokens(
        provider: string,
        providerAccountId: string,
        tokens: { refresh_token: string; id_token: string | null },
    ) {
        return prisma.account.update({
            where: { provider_providerAccountId: { provider, providerAccountId } },
            data: tokens,
        });
    }

    /** The provider tokens held for a user, for revoking them when the account goes. */
    fetchAccountTokens(userId: string, provider: string) {
        return prisma.account.findMany({
            where: { userId, provider, refresh_token: { not: null } },
            select: { refresh_token: true, id_token: true },
        });
    }

    fetchUserSettings(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                settings: true,
            },
        });
    }
}
