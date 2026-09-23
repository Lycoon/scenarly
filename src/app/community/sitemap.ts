import type { MetadataRoute } from "next";

import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { COMMUNITY_WEB_URL } from "@src/lib/community/constants";

/**
 * `/community/sitemap.xml`: the wall and every published Showcase entry.
 * Rendered per request (never at build, which has no database); the entry
 * list itself is cached and dropped whenever an entry goes up or down.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const entries = await ShowcaseService.listForSitemap();
    return [
        { url: `${COMMUNITY_WEB_URL}/showcase`, changeFrequency: "hourly", priority: 0.8 },
        ...entries.map((e) => ({
            url: `${COMMUNITY_WEB_URL}/showcase/${e.slug}`,
            lastModified: e.publishedAt,
            changeFrequency: "weekly" as const,
            priority: 0.6,
        })),
    ];
}
