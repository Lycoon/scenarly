/**
 * Community API calls, on the same client as `utils/requests.ts`. Every call
 * returns the envelope's `data` or throws `{ status, message, code }`, so the
 * pages can branch on `code` (INSUFFICIENT_TICKETS, HAS_ACTIVE_CLAIM, ...).
 */

import { apiFetch } from "@src/lib/api-client";
import type {
    CommunityFormat,
    CommunityGenre,
    CommunityRating,
    CommunityReportReason,
    CommunityShowcaseKind,
} from "@src/generated/client/browser";
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

const submissionForm = (file: Blob, fields: SubmissionFields) => {
    const form = new FormData();
    form.append("file", file, "screenplay.pdf");
    form.append("title", fields.title);
    form.append("logline", fields.logline);
    for (const g of fields.genres) form.append("genres", g);
    if (fields.format) form.append("format", fields.format);
    if (fields.sourceProjectId) form.append("sourceProjectId", fields.sourceProjectId);
    if (fields.destination) form.append("destination", fields.destination);
    return form;
};

export const createSubmission = (file: Blob, fields: SubmissionFields) =>
    call<{ id: string; status: string; poolExitAt: string | null }>("/api/community/submissions", {
        method: "POST",
        body: submissionForm(file, fields),
    });

export const withdrawSubmission = (submissionId: string) =>
    call<void>(`/api/community/submissions/${submissionId}`, json("DELETE"));

export const getSubmissionPdfUrl = (submissionId: string) =>
    call<PresignedPdf>(`/api/community/submissions/${submissionId}/pdf`);

// ── Showcase ────────────────────────────────────────────────────────────────

/** Upload straight to Showcase: a Showcase-only submission, published at once. */
export const uploadToShowcase = (file: Blob, fields: SubmissionFields, kind: CommunityShowcaseKind) => {
    const form = submissionForm(file, fields);
    form.append("kind", kind);
    return call<{ id: string; slug: string }>("/api/community/showcase/upload", { method: "POST", body: form });
};

export const publishToShowcase = (submissionId: string, kind: CommunityShowcaseKind) =>
    call<{ slug: string }>("/api/community/showcase", json("POST", { submissionId, kind }));

export const unpublishFromShowcase = (submissionId: string) =>
    call<void>(`/api/community/showcase/${submissionId}`, json("DELETE"));

export const setUpvote = (submissionId: string, on: boolean) =>
    call<{ upvoteCount: number }>(`/api/community/showcase/${submissionId}/upvote`, json(on ? "PUT" : "DELETE"));

export const getShowcasePdfUrl = (slug: string) =>
    call<PresignedPdf>(`/api/community/public/showcase/${encodeURIComponent(slug)}/pdf`);

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
