"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, RotateCw } from "lucide-react";

import { clientPlatform, isUpdateRequired, subscribeUpdateRequired } from "@src/lib/api-client";
import type { ClientPlatform } from "@src/lib/client-version";
import { openExternal } from "@src/lib/utils/open-external";

import styles from "./UpdateRequiredScreen.module.css";

// One App Store listing serves iPhone, iPad and Mac (same bundle id).
const APP_STORE_URL = "https://apps.apple.com/app/scenarly/id6805690357";

/** Where each store build is updated. Linux has no store, so no button: the text alone asks for the update. */
const STORE_URLS: Partial<Record<ClientPlatform, string>> = {
    ios: APP_STORE_URL,
    macos: APP_STORE_URL,
    android: "https://play.google.com/store/apps/details?id=com.scenarly",
    windows: "https://apps.microsoft.com/detail/9P7BZJP9746L",
};

/**
 * Covers the whole app once the server refuses this build as too old (see
 * client-version). Nothing can be dismissed: every request would be refused
 * again. A browser tab only needs a reload to get the current build.
 */
const UpdateRequiredScreen = () => {
    const t = useTranslations("updateRequired");
    const required = useSyncExternalStore(subscribeUpdateRequired, isUpdateRequired, () => false);
    if (!required) return null;

    const platform = clientPlatform();
    const isWeb = platform === "web";
    const storeUrl = platform ? STORE_URLS[platform] : undefined;

    return (
        <div className={styles.overlay} role="alertdialog" aria-modal="true" aria-labelledby="update-required-title">
            <div className={styles.modal}>
                <h2 id="update-required-title" className={styles.title}>
                    {t("title")}
                </h2>
                <p className={styles.description}>{isWeb ? t("webDescription") : t("description")}</p>
                {isWeb ? (
                    <button className={styles.btn} onClick={() => window.location.reload()}>
                        <RotateCw size={16} />
                        {t("reload")}
                    </button>
                ) : (
                    storeUrl && (
                        <button className={styles.btn} onClick={() => void openExternal(storeUrl)}>
                            <Download size={16} />
                            {t("update")}
                        </button>
                    )
                )}
            </div>
        </div>
    );
};

export default UpdateRequiredScreen;
