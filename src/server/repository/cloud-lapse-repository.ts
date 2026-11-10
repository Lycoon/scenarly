import { Prisma, ProjectRole } from "../../generated/client/client";
import prisma from "../db";

const activeCloud = (now: Date): Prisma.SubscriptionWhereInput => ({ plan: "CLOUD", expiresAt: { gt: now } });

const ownsAProject: Prisma.ProjectMemberListRelationFilter = { some: { role: ProjectRole.OWNER } };

const lapseSelect = {
    userId: true,
    lapsedAt: true,
    mediaDeletesAt: true,
    noticesSent: true,
    mediaDeletedAt: true,
} satisfies Prisma.CloudLapseSelect;

export class CloudLapseRepository {
    fetchByUser(userId: string) {
        return prisma.cloudLapse.findUnique({ where: { userId }, select: lapseSelect });
    }

    /** Owners of cloud projects whose Cloud plan has run out and who have no lapse yet. */
    listOwnersToLapse(now: Date, take: number) {
        return prisma.user.findMany({
            where: { projects: ownsAProject, cloudLapse: null, subscriptions: { none: activeCloud(now) } },
            select: { id: true },
            take,
        });
    }

    /** Lapses whose owner has Cloud again. */
    listRestorable(now: Date, take: number) {
        return prisma.cloudLapse.findMany({
            where: { user: { subscriptions: { some: activeCloud(now) } } },
            select: { userId: true },
            take,
        });
    }

    /** Lapses whose owner no longer owns any project: handed over or deleted. */
    deleteWithoutProjects() {
        return prisma.cloudLapse.deleteMany({ where: { user: { projects: { none: { role: ProjectRole.OWNER } } } } });
    }

    /** Lapses created but not announced yet: the tick that created them stopped short. */
    listUnannounced(lapseNotice: number, take: number) {
        return prisma.cloudLapse.findMany({ where: { noticesSent: { lt: lapseNotice } }, select: lapseSelect, take });
    }

    /**
     * Lapses owing a reminder: for some window, announced but short of its
     * notice, with the deletion no further off than its lead. Only due rows, so
     * lapses still waiting never crowd the due ones out of a batch.
     */
    listAwaitingNotices(windows: { notice: number; before: Date }[], lapseNotice: number, take: number) {
        return prisma.cloudLapse.findMany({
            where: {
                mediaDeletedAt: null,
                OR: windows.map(({ notice, before }) => ({
                    noticesSent: { gte: lapseNotice, lt: notice },
                    mediaDeletesAt: { lte: before },
                })),
            },
            select: lapseSelect,
            take,
        });
    }

    listMediaDeletionDue(now: Date, finalNotice: number, take: number) {
        return prisma.cloudLapse.findMany({
            where: { mediaDeletedAt: null, noticesSent: { gte: finalNotice }, mediaDeletesAt: { lte: now } },
            select: lapseSelect,
            take,
        });
    }

    /** Null when another tick created it first. */
    async create(userId: string, lapsedAt: Date, mediaDeletesAt: Date) {
        try {
            return await prisma.cloudLapse.create({ data: { userId, lapsedAt, mediaDeletesAt }, select: lapseSelect });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
            throw e;
        }
    }

    update(userId: string, data: Prisma.CloudLapseUpdateInput) {
        return prisma.cloudLapse.update({ where: { userId }, data });
    }

    delete(userId: string) {
        return prisma.cloudLapse.deleteMany({ where: { userId } });
    }

    /**
     * The projects a user owns, with every other member's address and whether
     * the project holds any media, for the locks and the notices.
     */
    listOwnedProjects(userId: string) {
        return prisma.project.findMany({
            where: { members: { some: { userId, role: ProjectRole.OWNER } } },
            select: {
                id: true,
                title: true,
                members: { where: { userId: { not: userId } }, select: { user: { select: { email: true } } } },
                _count: { select: { assets: true } },
            },
        });
    }

    countProjectAssets(projectId: string) {
        return prisma.projectAsset.count({ where: { projectId } });
    }

    /** Pending invitations to a user's projects: nobody should join a project that is read-only. */
    deleteInvitesToOwnedProjects(userId: string) {
        return prisma.projectInvitation.deleteMany({
            where: { project: { members: { some: { userId, role: ProjectRole.OWNER } } } },
        });
    }

    deleteProjectAssets(projectId: string) {
        return prisma.projectAsset.deleteMany({ where: { projectId } });
    }
}
