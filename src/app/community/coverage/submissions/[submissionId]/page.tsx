"use client";

import { useParams } from "next/navigation";

import SubmissionDetail from "@components/community/SubmissionDetail";

export default function CoverageSubmissionPage() {
    const { submissionId } = useParams<{ submissionId: string }>();
    return <SubmissionDetail submissionId={submissionId} />;
}
