import { ReactNode } from "react";
import { Metadata } from "next";

import CommunityShell from "@components/community/CommunityShell";

export const metadata: Metadata = {
    title: "Scenarly Community",
    description: "Coverage: exchange script reviews with other writers. Showcase: read scripts writers chose to share.",
};

export default function CommunityLayout({ children }: { children: ReactNode }) {
    return <CommunityShell>{children}</CommunityShell>;
}
