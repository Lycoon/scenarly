"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { useCookieUser } from "@src/lib/utils/hooks";
import { setUpvote } from "./requests";
import type {
    ClaimView,
    CommunityMe,
    MySubmission,
    OfferSetView,
    ShowcaseVotes,
    SubmissionDetail,
    TicketEntry,
} from "./types";

/**
 * Community SWR hooks. Every key is null until the session resolves to a user,
 * so a signed-out visitor never fires a 401 at the API (the fetcher treats
 * that as an auth problem and logs nothing, but there is no reason to ask).
 */

const memberKey = (user: unknown, key: string) => (user ? key : null);

export const useCommunityMe = () => {
    const { user, isLoading: isUserLoading } = useCookieUser();
    const { data, isLoading, mutate, error } = useSWR<CommunityMe>(memberKey(user, "/api/community/me"));
    return { me: data, isLoading: isUserLoading || (!!user && isLoading), mutate, error, user, isUserLoading };
};

export const useMySubmissions = (enabled = true) => {
    const { user } = useCookieUser();
    const { data, isLoading, mutate } = useSWR<{ submissions: MySubmission[] }>(
        enabled ? memberKey(user, "/api/community/submissions") : null,
    );
    return { submissions: data?.submissions, isLoading, mutate };
};

export const useSubmission = (submissionId: string | null) => {
    const { user } = useCookieUser();
    const { data, isLoading, mutate, error } = useSWR<SubmissionDetail>(
        submissionId ? memberKey(user, `/api/community/submissions/${submissionId}`) : null,
    );
    return { submission: data, isLoading, mutate, error };
};

/** The offer set. Off while a claim is active (the API would answer 409). */
export const useOffers = (enabled: boolean) => {
    const { user } = useCookieUser();
    const { data, isLoading, mutate, error } = useSWR<OfferSetView>(
        enabled ? memberKey(user, "/api/community/offers") : null,
    );
    return { offers: data, isLoading, mutate, error };
};

export const useActiveClaim = () => {
    const { user } = useCookieUser();
    const { data, isLoading, mutate } = useSWR<{ claim: ClaimView | null }>(
        memberKey(user, "/api/community/claims/active"),
    );
    return { claim: data?.claim ?? null, isLoading, mutate };
};

export const useEndedClaims = (enabled = true) => {
    const { user } = useCookieUser();
    const { data, isLoading } = useSWR<{ claims: ClaimView[] }>(
        enabled ? memberKey(user, "/api/community/claims") : null,
    );
    return { claims: data?.claims, isLoading };
};

export const useTickets = (enabled = true) => {
    const { user } = useCookieUser();
    const { data, isLoading } = useSWR<{ balance: number; entries: TicketEntry[] }>(
        enabled ? memberKey(user, "/api/community/tickets") : null,
    );
    return { balance: data?.balance, entries: data?.entries, isLoading };
};

/**
 * The signed-in viewer's votes on Showcase entries rendered from a cached
 * page: their own upvotes and fresh counts, keyed by submission id. Absent for
 * a signed-out visitor, who sees the counts the page was rendered with.
 * `toggle` is optimistic and settles on the count the server returns.
 */
export const useShowcaseVotes = (submissionIds: string[]) => {
    const { user } = useCookieUser();
    const key = submissionIds.length > 0 ? memberKey(user, `/api/community/showcase/votes?ids=${submissionIds.join(",")}`) : null;
    const { data, mutate } = useSWR<ShowcaseVotes>(key);

    const toggle = useCallback(
        async (submissionId: string, on: boolean, fallbackCount: number) => {
            const apply = (current: ShowcaseVotes | undefined, upvoteCount: number): ShowcaseVotes => ({
                votes: { ...current?.votes, [submissionId]: { upvoted: on, upvoteCount } },
            });
            const before = data?.votes[submissionId]?.upvoteCount ?? fallbackCount;
            await mutate(
                async (current) => apply(current, (await setUpvote(submissionId, on)).upvoteCount),
                {
                    optimisticData: (current) => apply(current, Math.max(0, before + (on ? 1 : -1))),
                    rollbackOnError: true,
                    populateCache: true,
                    revalidate: false,
                },
            );
        },
        [data, mutate],
    );

    return { votes: data?.votes, toggle };
};
