"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    useCookieUser,
    useIsPhone,
    useHasCloudPlan,
    useProjectMemberships,
    ExtendedProjectMembershipPayload,
} from "@src/lib/utils/hooks";
import { join } from "@src/lib/utils/misc";
import { createProjectShell, importFileAsProject } from "@src/lib/import/import-project";
import { useImportAccept } from "@src/lib/import/use-import-accept";
import { useAppNavigation } from "@src/lib/utils/navigation";
import { isFileBindingSupported } from "@src/lib/persistence/file-binding";
import { FileDown, FolderOpen, Plus, Users } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { openExternal } from "@src/lib/utils/open-external";
import { COMMUNITY_WEB_URL } from "@src/lib/community/constants";
import { useTranslations } from "next-intl";

import NewProjectPage from "./CreateProjectPage";
import ProjectItem from "./ProjectItem";
import autoAnimate from "@formkit/auto-animate";
import Loading from "../utils/Loading";

import LibrarySidebar from "./LibrarySidebar";

import page from "./ProjectPageContainer.module.css";

interface ProjectPageContainerProps {
    // Sidebar drawer state is owned by the page so the navbar burger can open it.
    // Desktop: a permanent column (open). Phone: an overlay drawer toggled here.
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

const ProjectPageContainer = ({ sidebarOpen, setSidebarOpen }: ProjectPageContainerProps) => {
    const { user } = useCookieUser();
    const isPhone = useIsPhone();
    const { hasCloudPlan, isLoading: isPlanLoading } = useHasCloudPlan();
    const { projects, isLoading, mutate } = useProjectMemberships();
    const { goToProject, goToProjects } = useAppNavigation();
    const router = useRouter();
    const params = useSearchParams();
    const importAccept = useImportAccept();
    const t = useTranslations("projects");
    const tNav = useTranslations("navbar");
    const [isCreating, setIsCreating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const parent = useRef(null);

    useEffect(() => {
        if (parent.current) autoAnimate(parent.current);
    }, [parent]);

    // "Open in Browser" on the landing homepage arrives as `/projects?quickstart`:
    // a visitor with nothing in their library should land in an editor, not on
    // an empty list, so give them a blank project and open it. Anyone who
    // already has projects just gets the list. Either way the param is consumed
    // on the spot, so a reload — or deleting the last project later — can't
    // trigger it again. The plan must be known too, or a Cloud user would get a
    // local-only project.
    const quickstart = params.has("quickstart");
    const isQuickstarting = quickstart && !isLoading && !isPlanLoading && !!projects && projects.length === 0;
    const quickstartRan = useRef(false);

    useEffect(() => {
        if (!quickstart || quickstartRan.current || isLoading || isPlanLoading || !projects) return;
        // Decide once per mount: StrictMode re-runs effects in dev, and a
        // refresh of the list mid-creation must not create a second project.
        quickstartRan.current = true;

        if (projects.length > 0) {
            goToProjects();
            return;
        }

        (async () => {
            try {
                const projectId = await createProjectShell(t("defaultTitle"), user, hasCloudPlan);
                goToProject(projectId);
            } catch (error) {
                console.error("[Projects] Quickstart project creation failed:", error);
                setImportError(t("form.failedToCreate"));
                goToProjects();
            }
        })();
    }, [quickstart, isLoading, isPlanLoading, projects, user, hasCloudPlan, goToProject, goToProjects, t]);

    // Unlike `startCreating`, this leaves the phone drawer open. The file picker
    // covers the screen on its own, so closing behind it buys nothing and costs
    // twice: cancelling the picker drops the user back on the list with the
    // drawer gone, and `importError` — which renders inside the sidebar — would
    // never be seen.
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    /**
     * Open a `.scenarly` from disk through the merge-aware flow.
     *
     * Distinct from Import above, which always makes a new project. This asks
     * what the file means for the library first — a project you already have
     * gets updated rather than duplicated — and binds the opened project to the
     * file so later edits flow back to it.
     */
    const handleOpenFile = async () => {
        setImportError(null);
        try {
            const { pickAndOfferScenarlyFile } = await import("@src/lib/import/scenarly-file-open");
            await pickAndOfferScenarlyFile();
        } catch (error) {
            console.error("[Projects] Could not open the file:", error);
            setImportError(error instanceof Error ? error.message : t("importError"));
        }
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportError(null);
        setIsImporting(true);

        try {
            // This now correctly preserves all project data (title page, board, etc.)
            const result = await importFileAsProject(file, user, undefined, hasCloudPlan);

            if (result.success && result.projectId) {
                // Refresh the project list
                await mutate();
                // Redirect to the new project
                goToProject(result.projectId);
            } else {
                console.error("Import failed:", result.error);
                setImportError(result.error || t("importError"));
            }
        } catch (error) {
            console.error("Import error:", error);
            setImportError(error instanceof Error ? error.message : t("importError"));
        } finally {
            setIsImporting(false);
            // Reset input so the same file can be selected again
            event.target.value = "";
        }
    };

    const startCreating = () => {
        if (isPhone) setSidebarOpen(false);
        setIsCreating(true);
    };

    // Also hold here while the quickstart project is being created and opened:
    // the empty list must not flash before the editor appears.
    if (isLoading || !projects || isQuickstarting) return <Loading />;

    const renderMain = () => {
        if (isCreating) {
            return <NewProjectPage setIsCreating={setIsCreating} />;
        }
        return (
            <div className={page.list}>
                <div className={page.list_header}>
                    <span className={page.col_poster} aria-hidden />
                    <span className={page.col_title}>{t("columns.title")}</span>
                    <span className={page.col_date}>{t("columns.lastEdited")}</span>
                    <span className={page.col_storage}>{t("columns.storage")}</span>
                </div>
                <div className={page.list_scroll}>
                    {projects.length === 0 ? (
                        <div className={page.empty}>{t("noProjects")}</div>
                    ) : (
                        <div ref={parent} className={page.rows}>
                            {projects.map((membership: ExtendedProjectMembershipPayload) => (
                                <ProjectItem
                                    key={membership.project.id}
                                    project={membership.project}
                                    isLocalOnly={membership.isLocalOnly}
                                    filePath={membership.filePath}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={page.layout}>
            {/* Hidden file input for import — shared by the sidebar and empty state. */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept={importAccept}
                style={{ display: "none" }}
            />

            <LibrarySidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} title={t("pageTitle")}>
                <button
                    className={join(page.action_btn, page.action_primary)}
                    onClick={startCreating}
                >
                    <Plus size={16} />
                    <span>{t("createBtn")}</span>
                </button>
                <button
                    className={page.action_btn}
                    onClick={handleImportClick}
                    disabled={isImporting}
                >
                    <FileDown size={16} />
                    <span>{isImporting ? t("importing") : t("importBtn")}</span>
                </button>
                {/* Opening a `.scenarly` belongs on the library, not inside a
                    project: the file may well be a *different* project, and
                    the answer can be "update the copy you already have" —
                    neither of which makes sense as an action taken from the
                    middle of the script you are writing. Desktop only; it
                    needs a real path to bind the project to afterwards. */}
                {isFileBindingSupported() && (
                    <button className={page.action_btn} onClick={handleOpenFile}>
                        <FolderOpen size={16} />
                        <span>{tNav("fileOpen")}</span>
                    </button>
                )}
                {/* Community lives on the web app only: the Tauri shells open it
                    in the browser, the web app navigates. */}
                <button
                    className={page.action_btn}
                    onClick={() => (isTauri() ? openExternal(`${COMMUNITY_WEB_URL}/showcase`) : router.push("/community/showcase"))}
                >
                    <Users size={16} />
                    <span>{t("communityBtn")}</span>
                </button>
                {importError && (
                    <p className={page.import_error} role="alert">
                        {importError}
                    </p>
                )}
            </LibrarySidebar>

            <main className={page.main}>
                {renderMain()}
            </main>
        </div>
    );
};

export default ProjectPageContainer;
