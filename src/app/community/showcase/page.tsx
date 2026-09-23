import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";

import ShowcaseGrid from "@components/community/ShowcaseGrid";
import ShowcaseIntl from "@components/community/ShowcaseIntl";
import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { COMMUNITY_WEB_URL } from "@src/lib/community/constants";
import { parseShowcaseQuery, showcaseHref } from "@src/lib/community/showcase";

import enMessages from "../../../../messages/en.json";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const t = createTranslator({ locale: "en", messages: enMessages, namespace: "community.showcase" });

/**
 * Reading the query string renders this page per request; the wall's data is
 * what is cached, for `WALL_TTL_S` (120 s) per query (see ShowcaseService.listWall).
 */
export const revalidate = 120;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
    const query = parseShowcaseQuery(await searchParams);
    const url = `${COMMUNITY_WEB_URL.replace(/\/community$/, "")}${showcaseHref(query)}`;
    const title = `${t("title")} | Scenarly®`;
    return {
        title,
        description: t("subtitle"),
        alternates: { canonical: url },
        openGraph: { title, description: t("subtitle"), url, type: "website" },
    };
}

export default async function ShowcasePage({ searchParams }: { searchParams: SearchParams }) {
    const query = parseShowcaseQuery(await searchParams);
    const wall = await ShowcaseService.listWall(query);
    // Past the last page: a real 404 rather than an empty wall under a crawlable URL.
    if (query.page > wall.pageCount) notFound();

    return (
        <ShowcaseIntl>
            <ShowcaseGrid query={query} wall={wall} />
        </ShowcaseIntl>
    );
}
