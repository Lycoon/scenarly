"use client";

import { useEffect } from "react";
import { UserRole } from "../../src/generated/client/browser";
import { AdminRoute } from "@src/lib/admin-route";
import { useCookieUser } from "@src/lib/utils/hooks";
import { useAppNavigation } from "@src/lib/utils/navigation";
import Loading from "@components/utils/Loading";
import AdminShell from "./AdminShell";
import StatsCards from "./StatsCards";
import BuildUsage from "./BuildUsage";
import UserSearch from "./UserSearch";
import UserDetail from "./UserDetail";
import ProjectSearch from "./ProjectSearch";
import ProjectDetail from "./ProjectDetail";

/**
 * The admin area inside the Tauri shells, rendered by the projects page when
 * its search params carry `?admin=…` (see admin-route.ts). Mirrors the web
 * pages in `src/app/admin`. The role check here only keeps non-admins off the
 * screen; the `/api/admin` routes enforce it.
 */
export default function AdminApp({ route }: { route: AdminRoute }) {
    const { user, isLoading } = useCookieUser();
    const { goToProjects } = useAppNavigation();
    const isAdmin = user?.role === UserRole.ADMIN;

    useEffect(() => {
        if (!isLoading && !isAdmin) goToProjects();
    }, [isLoading, isAdmin, goToProjects]);

    if (!isAdmin) return <Loading />;

    const email = user.email ?? "";
    const { section, id } = route;
    // Keyed by route so each screen starts scrolled to the top, as a page load would.
    const key = `${section}/${id ?? ""}`;

    if (section === "users") {
        return id ? (
            <AdminShell key={key} email={email} section="users" title="User detail">
                <UserDetail userId={id} />
            </AdminShell>
        ) : (
            <AdminShell key={key} email={email} section="users" title="Users" subtitle="Search by email or user ID">
                <UserSearch />
            </AdminShell>
        );
    }

    if (section === "projects") {
        return id ? (
            <AdminShell key={key} email={email} section="projects" title="Project detail">
                <ProjectDetail projectId={id} />
            </AdminShell>
        ) : (
            <AdminShell
                key={key}
                email={email}
                section="projects"
                title="Projects"
                subtitle="Search by title or project ID"
            >
                <ProjectSearch />
            </AdminShell>
        );
    }

    return (
        <AdminShell key={key} email={email} section="overview" title="Overview" subtitle="Platform-wide metrics">
            <StatsCards />
            <BuildUsage />
        </AdminShell>
    );
}
