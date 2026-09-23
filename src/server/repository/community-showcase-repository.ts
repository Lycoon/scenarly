import { CommunityShowcaseKind, Prisma } from "../../generated/client/client";
import prisma from "../db";
import { SHOWCASE_GRAVITY } from "../../lib/community/constants";
import type { ShowcaseSort } from "../../lib/community/showcase";
import type { Db } from "./community-profile-repository";

/**
 * What the public reads of an entry and its submission: never the author.
 * `sourceProjectId` is only read to tell whether the PDF came from the editor;
 * `toView` turns it into a boolean and the id never leaves the server.
 */
export const SHOWCASE_PUBLIC_SELECT = {
    submissionId: true,
    slug: true,
    kind: true,
    publishedAt: true,
    upvoteCount: true,
    submission: {
        select: {
            title: true,
            logline: true,
            genres: true,
            format: true,
            pageCount: true,
            fileDeletedAt: true,
            sourceProjectId: true,
        },
    },
} satisfies Prisma.CommunityShowcaseEntrySelect;

export type ShowcasePublicRow = Prisma.CommunityShowcaseEntryGetPayload<{ select: typeof SHOWCASE_PUBLIC_SELECT }>;

export interface ShowcaseListQuery {
    sort: ShowcaseSort;
    kind: CommunityShowcaseKind | null;
    skip: number;
    take: number;
    now: Date;
}

export class CommunityShowcaseRepository {
    findBySubmissionId(submissionId: string, db: Db = prisma) {
        return db.communityShowcaseEntry.findUnique({ where: { submissionId } });
    }

    create(data: { submissionId: string; kind: CommunityShowcaseKind; slug: string; publishedAt: Date }, db: Db = prisma) {
        return db.communityShowcaseEntry.create({ data });
    }

    /** Put an unpublished entry back on the wall under a new kind, as if first published now. */
    republish(submissionId: string, kind: CommunityShowcaseKind, now: Date, db: Db = prisma) {
        return db.communityShowcaseEntry.update({
            where: { submissionId },
            data: { kind, publishedAt: now, unpublishedAt: null },
        });
    }

    /** Take a published entry down. Returns the number of rows updated (0 = was not published). */
    async unpublish(submissionId: string, now: Date, db: Db = prisma): Promise<number> {
        const res = await db.communityShowcaseEntry.updateMany({
            where: { submissionId, unpublishedAt: null },
            data: { unpublishedAt: now },
        });
        return res.count;
    }

    findPublishedBySlug(slug: string) {
        return prisma.communityShowcaseEntry.findFirst({
            where: { slug, unpublishedAt: null },
            select: SHOWCASE_PUBLIC_SELECT,
        });
    }

    countPublished(kind: CommunityShowcaseKind | null) {
        return prisma.communityShowcaseEntry.count({ where: { unpublishedAt: null, ...(kind && { kind }) } });
    }

    /**
     * One page of the wall. `new` is a plain index-ordered read. `top` ranks in
     * SQL by `(upvotes + 1) / (hours since publishing + 2)^gravity` — the same
     * formula as `showcaseScore` — and only returns ids, so the rows themselves
     * go through the typed select. `now` is sent as epoch seconds: the columns
     * are naive UTC timestamps, which `EXTRACT(EPOCH ...)` reads as UTC.
     */
    async listPublished({ sort, kind, skip, take, now }: ShowcaseListQuery): Promise<ShowcasePublicRow[]> {
        if (sort === "new") {
            return prisma.communityShowcaseEntry.findMany({
                where: { unpublishedAt: null, ...(kind && { kind }) },
                orderBy: [{ publishedAt: "desc" }, { submissionId: "desc" }],
                skip,
                take,
                select: SHOWCASE_PUBLIC_SELECT,
            });
        }

        const nowSeconds = now.getTime() / 1000;
        const kindFilter = kind ? Prisma.sql`AND e.kind = CAST(${kind} AS "CommunityShowcaseKind")` : Prisma.empty;
        const ranked = await prisma.$queryRaw<{ id: string }[]>`
            SELECT e."submissionId" AS id
            FROM "CommunityShowcaseEntry" e
            WHERE e."unpublishedAt" IS NULL ${kindFilter}
            ORDER BY
                (e."upvoteCount" + 1) / POWER(
                    GREATEST(0, CAST(${nowSeconds} AS double precision) - EXTRACT(EPOCH FROM e."publishedAt")) / 3600 + 2,
                    CAST(${SHOWCASE_GRAVITY} AS double precision)
                ) DESC,
                e."publishedAt" DESC,
                e."submissionId" DESC
            LIMIT ${take} OFFSET ${skip}`;
        if (ranked.length === 0) return [];

        const rows = await prisma.communityShowcaseEntry.findMany({
            where: { submissionId: { in: ranked.map((r) => r.id) } },
            select: SHOWCASE_PUBLIC_SELECT,
        });
        const byId = new Map(rows.map((r) => [r.submissionId, r]));
        return ranked.map((r) => byId.get(r.id)).filter((r): r is ShowcasePublicRow => !!r);
    }

    /** Current counts of the given published entries, and which of them `userId` upvoted. */
    async votesFor(userId: string, submissionIds: string[]) {
        const [entries, upvotes] = await Promise.all([
            prisma.communityShowcaseEntry.findMany({
                where: { submissionId: { in: submissionIds }, unpublishedAt: null },
                select: { submissionId: true, upvoteCount: true },
            }),
            prisma.communityUpvote.findMany({
                where: { userId, submissionId: { in: submissionIds } },
                select: { submissionId: true },
            }),
        ]);
        const upvoted = new Set(upvotes.map((u) => u.submissionId));
        return entries.map((e) => ({ ...e, upvoted: upvoted.has(e.submissionId) }));
    }

    hasUpvoted(submissionId: string, userId: string) {
        return prisma.communityUpvote
            .findUnique({ where: { submissionId_userId: { submissionId, userId } }, select: { userId: true } })
            .then((row) => !!row);
    }

    /**
     * Withdraw every upvote a user gave, moving each entry's cached count down
     * with it (account deletion; the cascade alone would leave the counts high
     * until the nightly recount).
     */
    async removeAllVotesOf(userId: string, db: Db = prisma): Promise<void> {
        await db.$executeRaw`
            UPDATE "CommunityShowcaseEntry" e
            SET "upvoteCount" = GREATEST(0, e."upvoteCount" - 1)
            WHERE e."submissionId" IN (SELECT u."submissionId" FROM "CommunityUpvote" u WHERE u."userId" = ${userId})`;
        await db.communityUpvote.deleteMany({ where: { userId } });
    }

    /** Every published entry, for the sitemap. */
    listAllPublished() {
        return prisma.communityShowcaseEntry.findMany({
            where: { unpublishedAt: null },
            orderBy: { publishedAt: "desc" },
            select: { slug: true, publishedAt: true },
        });
    }
}
