"use client";

import { ReactNode, Suspense } from "react";

import CoverageGate from "@components/community/CoverageGate";
import Loading from "@components/utils/Loading";

/** Every Coverage page sits behind the session, entry-gate and membership checks. */
export default function CoverageLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<Loading />}>
            <CoverageGate>{children}</CoverageGate>
        </Suspense>
    );
}
