/**
 * Desktop authentication helpers using Tauri's secure store plugin.
 * Persists the NextAuth-encoded JWE issued by /api/desktop/token plus a small
 * cached user record so the desktop app can render its shell while offline.
 *
 * The store saves to a JSON file in the app's data directory:
 * - Windows: %APPDATA%/com.tauri.dev/
 * - macOS: ~/Library/Application Support/com.tauri.dev/
 * - Linux: ~/.local/share/com.tauri.dev/
 */

import { invoke } from "@tauri-apps/api/core";
import { StoreOptions } from "@tauri-apps/plugin-store";
import { clientHeaders, noteUpdateRequired } from "./api-client";
import { UPDATE_REQUIRED_STATUS } from "./client-version";
import type { AppleNativeSignInBody } from "./utils/api-bodies";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

type Store = Awaited<ReturnType<typeof import("@tauri-apps/plugin-store").load>>;

export type CachedDesktopUser = {
    id: string;
    email: string;
    createdAt: string;
};

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
    if (storeInstance) return storeInstance;
    const { load } = await import("@tauri-apps/plugin-store");
    storeInstance = await load("store.json", { autoSave: true } as StoreOptions);
    return storeInstance;
}

export async function setDesktopToken(token: string): Promise<void> {
    const store = await getStore();
    await store.set(TOKEN_KEY, token);
    await store.save();
}

export async function getDesktopToken(): Promise<string | null> {
    const store = await getStore();
    const token = await store.get<string>(TOKEN_KEY);
    return token ?? null;
}

export async function clearDesktopToken(): Promise<void> {
    const store = await getStore();
    await store.delete(TOKEN_KEY);
    await store.delete(USER_KEY);
    await store.save();
}

export async function hasDesktopToken(): Promise<boolean> {
    const token = await getDesktopToken();
    return token !== null;
}

export async function setCachedDesktopUser(user: CachedDesktopUser): Promise<void> {
    const store = await getStore();
    await store.set(USER_KEY, user);
    await store.save();
}

export async function getCachedDesktopUser(): Promise<CachedDesktopUser | null> {
    const store = await getStore();
    const user = await store.get<CachedDesktopUser>(USER_KEY);
    return user ?? null;
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const randomNonce = () => toHex(crypto.getRandomValues(new Uint8Array(24)));

/**
 * Generate a cryptographically random nonce for the OAuth bridge handshake.
 * The nonce identifies a single sign-in attempt across the desktop client and the
 * temporary in-memory bridge on the server.
 */
export function generateBridgeNonce(): string {
    return randomNonce();
}

/** What the sign-in sheets of the Apple apps reject with when the user closes them (src-tauri/src/apple_auth.rs). */
const SHEET_CANCELED = "canceled";

/**
 * Where /desktop-oauth/complete sends the in-app web sign-in sheet once the
 * session is in the bridge. Nothing serves this URL: the sheet watches for
 * its scheme and closes itself on the navigation.
 */
const NATIVE_OAUTH_CALLBACK_SCHEME = "scenarly";
export const NATIVE_OAUTH_CALLBACK_URL = `${NATIVE_OAUTH_CALLBACK_SCHEME}://oauth-complete`;

/**
 * Run the system's Sign in with Apple sheet (macOS and iOS apps) and return
 * what the server needs to check the outcome, or null when the user closed it.
 *
 * The nonce here is Apple's replay protection, unrelated to the bridge nonce
 * above: Apple is given its SHA-256 and copies that into the identity token,
 * and the server is given the nonce itself, so the token is only worth
 * anything to whoever started this very sign-in.
 */
export async function requestAppleCredential(): Promise<AppleNativeSignInBody | null> {
    const nonce = randomNonce();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));

    try {
        const credential = await invoke<Omit<AppleNativeSignInBody, "nonce">>("sign_in_with_apple", {
            nonceHash: toHex(new Uint8Array(digest)),
        });
        return { ...credential, nonce };
    } catch (err) {
        if (err === SHEET_CANCELED) return null;
        throw err;
    }
}

/**
 * Open a page of the website in the app's own web sign-in sheet
 * (ASWebAuthenticationSession, macOS and iOS apps). Resolves true once the page
 * navigated to the callback URL, false when the user closed the sheet.
 */
export async function openWebAuthSession(url: string): Promise<boolean> {
    try {
        await invoke("start_web_auth_session", { url, callbackScheme: NATIVE_OAUTH_CALLBACK_SCHEME });
        return true;
    } catch (err) {
        if (err === SHEET_CANCELED) return false;
        throw err;
    }
}

/**
 * Poll `/api/desktop/token/poll` until the bridge serves up the token issued by
 * the in-browser OAuth flow, or the timeout elapses. Returns null on timeout.
 */
export async function pollBridgeToken(
    nonce: string,
    options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string | null> {
    const intervalMs = options.intervalMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    const { signal } = options;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const url = `${apiBase}/api/desktop/token/poll?nonce=${encodeURIComponent(nonce)}`;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (signal?.aborted) return null;
        try {
            const res = await fetch(url, { headers: clientHeaders(), signal });
            noteUpdateRequired(res);
            if (res.status === UPDATE_REQUIRED_STATUS) return null;
            if (res.ok) {
                const json = (await res.json()) as { data?: { token?: string | null } };
                const token = json.data?.token;
                if (token) return token;
            }
        } catch {
            if (signal?.aborted) return null;
            // network blip — keep polling
        }
        if (signal?.aborted) return null;
        await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, intervalMs);
            signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
        }).catch(() => null);
    }
    return null;
}
