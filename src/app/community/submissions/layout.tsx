import { ReactNode, Suspense } from "react";
import { Metadata } from "next";

import CoverageGate from "@components/community/CoverageGate";
import Loading from "@components/utils/Loading";

export const metadata: Metadata = { title: "My submissions | Scenarly®" };

/**
 * The member's submissions, whichever half they went to, and each one's page.
 * They need a Community profile like submitting does, so the same gate.
 */
export default function SubmissionsLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<Loading />}>
            <CoverageGate>{children}</CoverageGate>
        </Suspense>
    );
}
