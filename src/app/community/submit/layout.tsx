import { ReactNode, Suspense } from "react";
import { Metadata } from "next";

import CoverageGate from "@components/community/CoverageGate";
import Loading from "@components/utils/Loading";

export const metadata: Metadata = { title: "Submit a script | Scenarly®" };

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
