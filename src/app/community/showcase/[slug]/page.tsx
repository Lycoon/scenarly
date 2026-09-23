import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";

import ShowcaseEntry from "@components/community/ShowcaseEntry";
import ShowcaseIntl from "@components/community/ShowcaseIntl";
import * as ShowcaseService from "@src/server/service/community-showcase-service";
import { COMMUNITY_WEB_URL } from "@src/lib/community/constants";

import enMessages from "../../../../../messages/en.json";

type Params = Promise<{ slug: string }>;

const tEnum = createTranslator({ locale: "en", messages: enMessages, namespace: "community.enums" });

/** Rendered on first request, then cached; unpublishing drops the cached page (revalidateShowcase). */
export const revalidate = 300;
export const dynamicParams = true;
export const generateStaticParams = async () => [];

const entryUrl = (slug: string) => `${COMMUNITY_WEB_URL}/showcase/${slug}`;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const entry = await ShowcaseService.getBySlug((await params).slug);
    if (!entry) return {};
    const title = `${entry.title} | Scenarly®`;
    return {
        title,
        description: entry.logline,
        alternates: { canonical: entryUrl(entry.slug) },
        openGraph: {
            title,
            description: entry.logline,
            url: entryUrl(entry.slug),
            type: "article",
            publishedTime: entry.publishedAt,
            siteName: "Scenarly",
        },
        twitter: { card: "summary", title, description: entry.logline },
    };
}

export default async function ShowcaseEntryPage({ params }: { params: Params }) {
    const entry = await ShowcaseService.getBySlug((await params).slug);
    if (!entry) notFound();

    // No author: a script can be in the Coverage pool and here at once.
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: entry.title,
        abstract: entry.logline,
        genre: entry.genres.map((g) => tEnum(`genres.${g}`)),
        datePublished: entry.publishedAt,
        inLanguage: "en",
        url: entryUrl(entry.slug),
        interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/LikeAction",
            userInteractionCount: entry.upvoteCount,
        },
        isPartOf: { "@type": "WebSite", name: "Scenarly", url: "https://scenarly.com" },
    };

    return (
        <>
            <script
                type="application/ld+json"
                // `<` escaped so a title can never close the script element.
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
            />
            <ShowcaseIntl>
                <ShowcaseEntry entry={entry} />
            </ShowcaseIntl>
        </>
    );
}
