"use client";

import { useParams } from "next/navigation";

import SubmissionDetail from "@components/community/SubmissionDetail";

export default function SubmissionPage() {
    const { submissionId } = useParams<{ submissionId: string }>();
    return <SubmissionDetail submissionId={submissionId} />;
}
