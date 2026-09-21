import { ReactNode } from "react";
import { Metadata } from "next";

import CommunityShell from "@components/community/CommunityShell";

export const metadata: Metadata = {
    title: "Scenarly Community",
    description: "Coverage: exchange screenplay reviews with other writers. Showcase: read screenplays writers chose to share.",
};

export default function CommunityLayout({ children }: { children: ReactNode }) {
    return <CommunityShell>{children}</CommunityShell>;
}
