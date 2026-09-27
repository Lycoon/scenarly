/**
 * Caching of the public Showcase reads. The wall reads its query string, which
 * makes the page itself render per request, so the cache sits on the data: one
 * entry per (sort, kind, page) for `WALL_TTL_S`. Entry pages are ISR'd by path.
 * Publishing, unpublishing and withdrawing drop both at once; upvotes do not
 * (a count may lag by the TTL, the viewer's own vote never does).
 */

import { revalidatePath, revalidateTag } from "next/cache";

export const SHOWCASE_TAG = "community-showcase";
export const WALL_TTL_S = 120;

/** An entry went up or came down: the wall, its page and the sitemap are stale. */
export function revalidateShowcase(slug: string) {
    revalidateTag(SHOWCASE_TAG, { expire: 0 });
    revalidatePath(`/community/showcase/${slug}`);
}
