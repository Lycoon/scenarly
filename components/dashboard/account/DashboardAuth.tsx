"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSWRConfig } from "swr";
import { isTauri } from "@tauri-apps/api/core";

import { requestSignInCode, verifySignInCode } from "@src/lib/utils/requests";
import { ApiResponse } from "@src/lib/utils/api-utils";
import { SignInCodeError } from "@src/lib/utils/api-bodies";

import OAuthButtons from "./OAuthButtons";

import form from "./../../utils/Form.module.css";
import sharedStyles from "../project/ProjectSettings.module.css";
import styles from "./AuthForm.module.css";

type MessageType = "success" | "error" | "info";
type Step = "email" | "code";

const ERROR_KEYS = {
    [SignInCodeError.THROTTLED]: "throttled",
    [SignInCodeError.INVALID]: "invalidCode",
    [SignInCodeError.EXPIRED]: "expiredCode",
    [SignInCodeError.LOCKED]: "locked",
} as const;

/**
 * Email sign-in in two steps: the address, then the 6-digit code mailed to
 * it. The code is checked here, so the session comes straight back — a cookie
 * on the web, a bearer token kept in the secure store in the apps.
 */
const DashboardAuth = () => {
    const tAuth = useTranslations("auth");
    const { mutate } = useSWRConfig();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: MessageType; text: string } | null>(null);

    const failureText = async (res: Response, fallback: string) => {
        const json = (await res.json().catch(() => ({}))) as ApiResponse;
        const key = ERROR_KEYS[json.code as keyof typeof ERROR_KEYS];
        return key ? tAuth(key) : fallback;
    };

    const run = async (task: () => Promise<void>, fallback: string) => {
        if (loading) return;
        setLoading(true);
        setMessage(null);
        try {
            await task();
        } catch (err) {
            console.error("[DashboardAuth] Sign-in request failed:", err);
            setMessage({ type: "error", text: fallback });
        } finally {
            setLoading(false);
        }
    };

    const sendCode = (resend: boolean) =>
        run(async () => {
            const res = await requestSignInCode({ email });
            if (!res.ok) {
                setMessage({ type: "error", text: await failureText(res, tAuth("requestFailed")) });
                return;
            }
            setCode("");
            setStep("code");
            if (resend) setMessage({ type: "info", text: tAuth("newCodeSent") });
        }, tAuth("requestFailed"));

    const verifyCode = () =>
        run(async () => {
            const desktop = isTauri();
            const res = await verifySignInCode({ email, code, desktop });
            if (!res.ok) {
                setMessage({ type: "error", text: await failureText(res, tAuth("verifyFailed")) });
                return;
            }
            if (desktop) {
                const { data } = (await res.json()) as ApiResponse<{ token: string }>;
                if (!data?.token) throw new Error("No session token in the response");
                const { setDesktopToken } = await import("@src/lib/desktop-auth");
                await setDesktopToken(data.token);
            }
            await mutate("/api/users/cookie");
            await mutate("/api/users");
        }, tAuth("verifyFailed"));

    if (step === "code") {
        return (
            <form
                className={`${sharedStyles.settingsForm} ${styles.authForm}`}
                onSubmit={(e) => {
                    e.preventDefault();
                    verifyCode();
                }}
            >
                <p className={styles.authInfoText}>{tAuth("codeSent", { email })}</p>
                <div className={sharedStyles.formGroup}>
                    <label htmlFor="auth-code" className={form.label}>
                        {tAuth("codeLabel")}
                    </label>
                    <input
                        id="auth-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        maxLength={6}
                        value={code}
                        onChange={(e) => {
                            // Pasted codes may come with spaces or dashes.
                            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setMessage(null);
                        }}
                        className={sharedStyles.input}
                        autoFocus
                        required
                    />
                </div>

                {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

                <div className={styles.authActions}>
                    <button
                        type="submit"
                        className={`${sharedStyles.formBtn} ${styles.authSubmitBtn}`}
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? tAuth("verifying") : tAuth("verify")}
                    </button>
                </div>

                <div className={styles.authLinks}>
                    <p className={styles.authSwitchRow}>
                        <button type="button" className={styles.authSwitchLink} onClick={() => sendCode(true)} disabled={loading}>
                            {tAuth("resendCode")}
                        </button>
                    </p>
                    <p className={styles.authSwitchRow}>
                        <button
                            type="button"
                            className={styles.authSwitchLink}
                            onClick={() => {
                                setStep("email");
                                setMessage(null);
                            }}
                            disabled={loading}
                        >
                            {tAuth("useDifferentEmail")}
                        </button>
                    </p>
                </div>
            </form>
        );
    }

    return (
        <form
            className={`${sharedStyles.settingsForm} ${styles.authForm}`}
            onSubmit={(e) => {
                e.preventDefault();
                sendCode(false);
            }}
        >
            <div className={sharedStyles.formGroup}>
                <label htmlFor="auth-email" className={form.label}>
                    {tAuth("emailLabel")}
                </label>
                <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setMessage(null);
                    }}
                    className={sharedStyles.input}
                    required
                />
            </div>

            {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

            <div className={styles.authActions}>
                <button
                    type="submit"
                    className={`${sharedStyles.formBtn} ${styles.authSubmitBtn}`}
                    disabled={loading}
                >
                    {loading ? tAuth("sending") : tAuth("sendCode")}
                </button>
            </div>

            <OAuthButtons />
        </form>
    );
};

export default DashboardAuth;
