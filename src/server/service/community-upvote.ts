/**
 * The upvote transaction body, apart from the Showcase service so it has no
 * runtime import: the test suite runs in a browser and drives it with an
 * in-memory transaction client.
 */

import type { Db } from "../repository/community-profile-repository";

/** The slice of the transaction client an upvote touches. */
export type UpvoteTx = {
    communityShowcaseEntry: Pick<Db["communityShowcaseEntry"], "findFirst" | "update">;
    communityUpvote: Pick<Db["communityUpvote"], "createMany" | "deleteMany">;
};

/**
 * Set or clear `userId`'s upvote on a published entry and move the cached
 * count by exactly the number of rows that changed, inside the caller's
 * transaction. Idempotent: a second PUT inserts nothing (`ON CONFLICT DO
 * NOTHING`, not a caught P2002 — a unique violation would abort the whole
 * Postgres transaction) and a second DELETE deletes nothing, so neither moves
 * the count. Two concurrent requests for the same vote serialise on the row,
 * and only the one that changed it touches the counter.
 *
 * Returns the count after the change, or null when the entry is not published.
 */
export async function applyUpvote(tx: UpvoteTx, submissionId: string, userId: string, on: boolean): Promise<number | null> {
    const entry = await tx.communityShowcaseEntry.findFirst({
        where: { submissionId, unpublishedAt: null },
        select: { upvoteCount: true },
    });
    if (!entry) return null;

    const { count } = on
        ? await tx.communityUpvote.createMany({ data: [{ submissionId, userId }], skipDuplicates: true })
        : await tx.communityUpvote.deleteMany({ where: { submissionId, userId } });
    if (count === 0) return entry.upvoteCount;

    const updated = await tx.communityShowcaseEntry.update({
        where: { submissionId },
        data: { upvoteCount: on ? { increment: count } : { decrement: count } },
        select: { upvoteCount: true },
    });
    return updated.upvoteCount;
}
