/**
 * Community API calls, on the same client as `utils/requests.ts`. Every call
 * returns the envelope's `data` or throws `{ status, message, code }`, so the
 * pages can branch on `code` (INSUFFICIENT_CREDITS, HAS_ACTIVE_CLAIM, ...).
 */

import { apiFetch } from "@src/lib/api-client";
import type { CommunityFormat, CommunityGenre, CommunityRating, CommunityReportReason } from "@src/generated/client/browser";
import type { ClaimView, OfferSetView, PresignedPdf } from "./types";

export interface ApiError {
    status: number;
    message: string;
    code?: string;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
        res = await apiFetch(url, init);
    } catch {
        throw { status: 0, message: "Server unreachable" } satisfies ApiError;
    }
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => ({}))) as { data?: T; message?: string; code?: string };
    if (res.ok) return json.data as T;
    throw { status: res.status, message: json.message ?? "Request failed", code: json.code } satisfies ApiError;
}

const json = (method: string, body?: object): RequestInit => ({
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
});

export const isApiError = (e: unknown): e is ApiError =>
    typeof e === "object" && e !== null && "status" in e && "message" in e;

// ── Membership ──────────────────────────────────────────────────────────────

export const joinCommunity = (penName: string) => call<{ penName: string }>("/api/community/join", json("POST", { penName }));

export const updatePenName = (penName: string) => call<{ penName: string }>("/api/community/me", json("PATCH", { penName }));

// ── Submissions ─────────────────────────────────────────────────────────────

export interface SubmissionFields {
    title: string;
    logline: string;
    genres: CommunityGenre[];
    /** Showcase-only uploads; ignored for Coverage (always a feature). */
    format?: CommunityFormat;
    sourceProjectId?: string;
    destination?: "COVERAGE" | "SHOWCASE_ONLY";
}

export const createSubmission = (file: Blob, fields: SubmissionFields) => {
    const form = new FormData();
    form.append("file", file, "screenplay.pdf");
    form.append("title", fields.title);
    form.append("logline", fields.logline);
    for (const g of fields.genres) form.append("genres", g);
    if (fields.format) form.append("format", fields.format);
    if (fields.sourceProjectId) form.append("sourceProjectId", fields.sourceProjectId);
    if (fields.destination) form.append("destination", fields.destination);
    return call<{ id: string; status: string; poolExitAt: string | null }>("/api/community/submissions", {
        method: "POST",
        body: form,
    });
};

export const withdrawSubmission = (submissionId: string) =>
    call<void>(`/api/community/submissions/${submissionId}`, json("DELETE"));

export const getSubmissionPdfUrl = (submissionId: string) =>
    call<PresignedPdf>(`/api/community/submissions/${submissionId}/pdf`);

// ── Reviewing ───────────────────────────────────────────────────────────────

export const reshuffleOffers = () => call<OfferSetView>("/api/community/offers/reshuffle", json("POST"));

export const claimSubmission = (submissionId: string) =>
    call<{ id: string; floorAt: string; deadlineAt: string }>("/api/community/claims", json("POST", { submissionId }));

export const getClaimPdfUrl = (claimId: string) => call<PresignedPdf>(`/api/community/claims/${claimId}/pdf`);

export interface DraftFields {
    worksWell: string;
    doesNotWork: string;
    remarks: string;
    signed: boolean;
}

export const saveDraft = (claimId: string, draft: DraftFields) =>
    call<{ wordCount: number; minWords: number; updatedAt: string }>(
        `/api/community/claims/${claimId}/review`,
        json("PUT", draft),
    );

export const submitReview = (claimId: string) =>
    call<void>(`/api/community/claims/${claimId}/review/submit`, json("POST"));

export const releaseClaim = (claimId: string) => call<void>(`/api/community/claims/${claimId}/release`, json("POST"));

export const rateReview = (claimId: string, rating: CommunityRating) =>
    call<void>(`/api/community/reviews/${claimId}/rate`, json("POST", { rating }));

export const reportReview = (claimId: string, reason: CommunityReportReason, details?: string) =>
    call<{ id: string }>(`/api/community/reviews/${claimId}/report`, json("POST", { reason, details }));

export type { ClaimView };
