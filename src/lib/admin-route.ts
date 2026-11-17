/**
 * The admin area has two addresses for the same screens:
 * - Web: real routes under `/admin` (server-guarded pages in `src/app/admin`).
 * - Tauri apps: the static export has no `/admin` (the build hides it, its
 *   pages are server-rendered), so the screens render inside the projects page,
 *   addressed by search params like an open project: `?admin=users&id=…`.
 */
export type AdminSection = "overview" | "users" | "projects";
export type AdminRoute = { section: AdminSection; id?: string };

const SECTIONS: AdminSection[] = ["overview", "users", "projects"];

export const adminPath = ({ section, id }: AdminRoute) =>
    section === "overview" ? "/admin" : `/admin/${section}${id ? `/${encodeURIComponent(id)}` : ""}`;

export const adminSearch = ({ section, id }: AdminRoute) =>
    `?admin=${section}${id ? `&id=${encodeURIComponent(id)}` : ""}`;

/** The in-app admin route carried by the search params, null outside the admin. */
export const parseAdminSearch = (params: URLSearchParams): AdminRoute | null => {
    const section = params.get("admin");
    if (!section) return null;
    return {
        section: SECTIONS.includes(section as AdminSection) ? (section as AdminSection) : "overview",
        id: params.get("id") ?? undefined,
    };
};
