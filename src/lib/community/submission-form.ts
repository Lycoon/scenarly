/**
 * The multipart body shared by `POST /community/submissions` and
 * `POST /community/showcase/upload`: the PDF plus its metadata. Server only.
 */

import { NextRequest } from "next/server";

import { BodyFieldError, validate } from "@src/lib/utils/api-utils";
import {
    GENRES_MAX,
    GENRES_MIN,
    LOGLINE_MAX_LENGTH,
    LOGLINE_MIN_LENGTH,
    MAX_PDF_BYTES,
    TITLE_MAX_LENGTH,
} from "@src/lib/community/constants";
import { CommunityFormat, CommunityGenre, CommunityShowcaseKind } from "@src/generated/client/client";

import z from "zod";

const FieldsSchema = z.object({
    title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
    logline: z.string().trim().min(LOGLINE_MIN_LENGTH).max(LOGLINE_MAX_LENGTH),
    genres: z.array(z.nativeEnum(CommunityGenre)).min(GENRES_MIN).max(GENRES_MAX),
    // Ignored for COVERAGE (always FEATURE); picks the page bounds for Showcase-only uploads.
    format: z.nativeEnum(CommunityFormat).default(CommunityFormat.FEATURE),
    sourceProjectId: z.string().optional(),
    destination: z.enum(["COVERAGE", "SHOWCASE_ONLY"]).default("COVERAGE"),
    kind: z.nativeEnum(CommunityShowcaseKind).optional(),
});

export async function readSubmissionForm(req: NextRequest) {
    // Reject oversized bodies before reading them into memory.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_PDF_BYTES + 64 * 1024) throw new BodyFieldError("PDF exceeds the maximum size");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new BodyFieldError("Missing PDF file");

    const fields = validate(FieldsSchema, {
        title: form.get("title"),
        logline: form.get("logline"),
        genres: form.getAll("genres"),
        format: form.get("format") ?? undefined,
        sourceProjectId: form.get("sourceProjectId") ?? undefined,
        destination: form.get("destination") ?? undefined,
        kind: form.get("kind") ?? undefined,
    });

    return { bytes: new Uint8Array(await file.arrayBuffer()), fields };
}
