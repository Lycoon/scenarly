"use client";

import { ReactNode, Suspense, useState } from "react";

import HomeNavbar from "@components/navbar/HomeNavbar";
import DashboardModal from "@components/dashboard/DashboardModal";
import Loading from "@components/utils/Loading";
import CommunitySidebar from "./CommunitySidebar";
import CommunityTabs from "./CommunityTabs";

import page from "@components/projects/ProjectPageContainer.module.css";

/**
 * Frame of every `/community` page: the same chrome as the projects library —
 * the home navbar, the fixed left sidebar (a drawer on phones, opened by the
 * navbar burger) and the dashboard drawer for settings and sign-in.
 */
const CommunityShell = ({ children }: { children: ReactNode }) => {
    // Start closed: on desktop the sidebar is a permanent column regardless of
    // this flag (see ProjectPageContainer); it only governs the phone drawer.
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <Suspense fallback={<Loading />}>
            <HomeNavbar onToggleSidebar={() => setSidebarOpen((open) => !open)} nav={<CommunityTabs />} />
            <div className={page.layout}>
                <CommunitySidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
                <main className={page.main}>{children}</main>
            </div>
            <DashboardModal />
        </Suspense>
    );
};

export default CommunityShell;
