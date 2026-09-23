"use client";

import { ReactNode, Suspense } from "react";

import CoverageGate from "@components/community/CoverageGate";
import Loading from "@components/utils/Loading";

/**
 * Submitting needs a Community profile whichever the destination, so the page
 * sits behind the same gate as Coverage. The Suspense boundary also covers the
 * page's `useSearchParams`.
 */
export default function SubmitLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<Loading />}>
            <CoverageGate>{children}</CoverageGate>
        </Suspense>
    );
}
