import { isTauri } from "@tauri-apps/api/core";

/**
 * Opens a URL in the user's default browser. Inside the Tauri shells a plain
 * `window.open`/`target="_blank"` stays trapped in the webview, so those go
 * through the opener plugin instead.
 */
export const openExternal = async (url: string) => {
    if (isTauri()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
    } else {
        window.open(url, "_blank");
    }
};
