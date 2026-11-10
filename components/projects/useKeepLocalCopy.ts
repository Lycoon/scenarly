"use client";

import { useCallback, useContext, useState } from "react";

import { ProjectContext } from "@src/context/ProjectContext";
import { useAppNavigation } from "@src/lib/utils/navigation";

/**
 * Copy the open cloud project into a new project on this device and open it,
 * leaving the cloud one as it is. Its media is fetched first, so the copy is
 * whole even for images this device never displayed: this is how a member of
 * a project whose owner lost Cloud keeps everything before the media goes.
 */
export const useKeepLocalCopy = () => {
    const { project, repository, projectTitle } = useContext(ProjectContext);
    const { goToProject } = useAppNavigation();
    const [isCopying, setIsCopying] = useState(false);

    const keepLocalCopy = useCallback(async () => {
        if (!project || !repository || isCopying) return;
        const { id, title, description } = project.project;
        setIsCopying(true);
        try {
            const { cacheReferencedAssets } = await import("@src/lib/assets/asset-store");
            const { copyToLocalProject } = await import("@src/lib/persistence/storage-provider/local-persistence");
            const missing = await cacheReferencedAssets(id, repository.getState());
            if (missing > 0) console.warn(`[KeepLocalCopy] ${missing} media file(s) could not be downloaded`);
            const copy = await copyToLocalProject(id, projectTitle || title, description ?? undefined);
            goToProject(copy.id);
        } catch (e) {
            console.error("[KeepLocalCopy] Copy failed:", e);
        } finally {
            setIsCopying(false);
        }
    }, [project, repository, projectTitle, isCopying, goToProject]);

    return { keepLocalCopy, isCopying };
};
