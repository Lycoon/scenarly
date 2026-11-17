"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { isTauri } from "@tauri-apps/api/core";
import { useTranslations } from "next-intl";
import { useDesktopBridgeAuth } from "@src/lib/utils/hooks";
import { isAppleStoreBuild } from "@src/lib/apple-iap";
import { signInWithAppleCredential } from "@src/lib/utils/requests";

import GoogleIcon from "@components/icons/GoogleIcon";
import AppleIcon from "@components/icons/AppleIcon";

import sharedStyles from "../project/ProjectSettings.module.css";
import styles from "./AuthForm.module.css";

type Provider = "google" | "apple";

type Props = {
    callbackUrl?: string;
};

/**
 * Google and Apple sign-in, by three routes:
 *
 *  - Web: Auth.js, in this page.
 *  - Windows, Linux and Android apps: the website's sign-in opened in the
 *    default browser, and the session picked up from the bridge by polling.
 *  - macOS and iOS apps, which App Review does not let leave the app: Apple
 *    through the system's own sheet, Google through the same bridge but with
 *    the website shown in the app's web sign-in sheet.
 */
const OAuthButtons = ({ callbackUrl = "/projects" }: Props) => {
    const { completeBridgeAuth, cancelBridgeAuth, acceptDesktopToken } = useDesktopBridgeAuth();
    const t = useTranslations("oauth");
    const tAuth = useTranslations("auth");
    const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
    const [error, setError] = useState<string | null>(null);

    /** Apple's system sheet. Closing it is not an error: the buttons just come back. */
    const signInWithAppleSheet = async () => {
        const { requestAppleCredential } = await import("@src/lib/desktop-auth");
        const credential = await requestAppleCredential();
        if (!credential) return;

        const token = await signInWithAppleCredential(credential);
        if (!token) throw new Error("The server refused the Apple credential");
        await acceptDesktopToken(token);
    };

    const signInThroughBridge = async (provider: Provider, inApp: boolean) => {
        const { generateBridgeNonce, openWebAuthSession } = await import("@src/lib/desktop-auth");

        const nonce = generateBridgeNonce();
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const bridgeUrl = `${apiBase}/desktop-oauth/start?provider=${provider}&nonce=${encodeURIComponent(nonce)}`;

        if (!inApp) {
            const { openUrl } = await import("@tauri-apps/plugin-opener");
            await openUrl(bridgeUrl);
            return completeBridgeAuth(nonce);
        }

        // The poll delivers the session here too: the sheet only shows the
        // website, and the callback it comes back with carries nothing. So both
        // run side by side, and a sheet the user closed ends the poll.
        const [result] = await Promise.all([
            completeBridgeAuth(nonce),
            openWebAuthSession(`${bridgeUrl}&native=1`).then(
                (completed) => {
                    if (!completed) cancelBridgeAuth();
                },
                (err) => {
                    cancelBridgeAuth();
                    throw err;
                },
            ),
        ]);
        return result;
    };

    const startOAuth = async (provider: Provider) => {
        setError(null);

        if (!isTauri()) {
            await signIn(provider, { callbackUrl });
            return;
        }

        setPendingProvider(provider);
        try {
            const inApp = isAppleStoreBuild();
            if (inApp && provider === "apple") {
                await signInWithAppleSheet();
            } else {
                const result = await signInThroughBridge(provider, inApp);
                if (result === "timeout") setError(t("timeout"));
            }
        } catch (err) {
            console.error("[OAuthButtons] Desktop OAuth failed:", err);
            setError(t("error"));
        } finally {
            setPendingProvider(null);
        }
    };

    // The Apple apps never send anyone to a browser, so they do not say they wait for one.
    const waitingLabel = pendingProvider && isAppleStoreBuild() ? tAuth("verifying") : t("waiting");

    return (
        <>
            <div className={styles.divider}>{t("orContinueWith")}</div>
            <div className={styles.oauthGroup}>
                <button
                    type="button"
                    className={`${sharedStyles.formBtn} ${styles.oauthBtn}`}
                    onClick={() => startOAuth("google")}
                    disabled={pendingProvider !== null}
                >
                    <GoogleIcon size={18} />
                    {pendingProvider === "google" ? waitingLabel : t("continueWithGoogle")}
                </button>
                <button
                    type="button"
                    className={`${sharedStyles.formBtn} ${styles.oauthBtn}`}
                    onClick={() => startOAuth("apple")}
                    disabled={pendingProvider !== null}
                >
                    <AppleIcon size={18} />
                    {pendingProvider === "apple" ? waitingLabel : t("continueWithApple")}
                </button>
            </div>
            {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}
        </>
    );
};

export default OAuthButtons;
