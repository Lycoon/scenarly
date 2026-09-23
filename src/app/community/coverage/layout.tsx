import { ReactNode, Suspense } from "react";
import { Metadata } from "next";

import CoverageGate from "@components/community/CoverageGate";
import Loading from "@components/utils/Loading";

export const metadata: Metadata = { title: "Coverage | Scenarly®" };

/** Every Coverage page sits behind the session, entry-gate and membership checks. */
export default function CoverageLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<Loading />}>
            <CoverageGate>{children}</CoverageGate>
        </Suspense>
    );
}
