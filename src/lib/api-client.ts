/**
 * Shared HTTP client used by both the SWR fetcher (`fetcher.ts`) and the explicit
 * request helpers (`utils/requests.ts`).
 *
 * Handles two environments:
 *  - Web: relative URLs hit Next.js routes; cookies do the auth.
 *  - Tauri desktop: rewrites relative URLs against `NEXT_PUBLIC_API_URL`, attaches
 *    the cached desktop JWE in `Authorization: Bearer …`, and tags the request
 *    with `x-client-type: desktop`.
 *
 * Both name the build they come from (see client-version), and both learn here
 * when the server no longer serves it.
 */

import { isTauri } from "@tauri-apps/api/core";
import {
    CLIENT_PLATFORM_HEADER,
    CLIENT_VERSION_HEADER,
    ClientPlatform,
    UPDATE_REQUIRED_STATUS,
    versionName,
} from "./client-version";
import { osName, OSName } from "./utils/platform";

const DEFAULT_DESKTOP_API_BASE = "http://localhost:3000";

const NATIVE_PLATFORMS: Record<OSName, ClientPlatform> = {
    iOS: "ios",
    macOS: "macos",
    Android: "android",
    Windows: "windows",
    Linux: "linux",
};

/** The platform this build was made for; null in a Tauri shell whose OS the user agent hides. */
export const clientPlatform = (): ClientPlatform | null => {
    if (!isTauri()) return "web";
    const os = osName();
    return os ? NATIVE_PLATFORMS[os] : null;
};

/** The headers that say which build a request comes from. */
export function clientHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (isTauri()) headers["x-client-type"] = "desktop";
    const platform = clientPlatform();
    if (platform) headers[CLIENT_PLATFORM_HEADER] = platform;
    const version = versionName(process.env.NEXT_PUBLIC_APP_VERSION);
    if (version) headers[CLIENT_VERSION_HEADER] = version;
    return headers;
}

/*
 * Set for good once the server has refused this build as too old: nothing it
 * asks for will be served again until it is updated (or, on the web, reloaded).
 */
let updateRequired = false;
const updateRequiredListeners = new Set<() => void>();

export const isUpdateRequired = () => updateRequired;

export const subscribeUpdateRequired = (listener: () => void) => {
    updateRequiredListeners.add(listener);
    return () => {
        updateRequiredListeners.delete(listener);
    };
};

/** Note a response; a refusal of this build turns the app over to UpdateRequiredScreen. */
export function noteUpdateRequired(response: Response) {
    if (response.status !== UPDATE_REQUIRED_STATUS || updateRequired) return;
    updateRequired = true;
    for (const listener of updateRequiredListeners) listener();
}

function resolveUrl(input: RequestInfo): string {
    const url = typeof input === "string" ? input : input.url;
    if (!isTauri() || url.startsWith("http")) return url;
    const base = process.env.NEXT_PUBLIC_API_URL || DEFAULT_DESKTOP_API_BASE;
    return `${base}${url}`;
}

async function buildHeaders(initHeaders?: HeadersInit): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (initHeaders) Object.assign(headers, initHeaders as Record<string, string>);
    Object.assign(headers, clientHeaders());

    if (isTauri()) {
        const { getDesktopToken } = await import("./desktop-auth");
        const token = await getDesktopToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Issue an authenticated API request and return the raw `Response`.
 * Callers decide what to do with the body and status.
 */
export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const headers = await buildHeaders(init?.headers);
    // A multipart body must let the browser write its own boundary header.
    if (init?.body instanceof FormData) delete headers["Content-Type"];
    const response = await fetch(resolveUrl(input), { ...init, headers });
    noteUpdateRequired(response);
    return response;
}

/**
 * Issue an authenticated API request, parse the JSON envelope, and return the
 * `data` field. Throws a structured error on non-2xx responses so SWR can react.
 *
 * The desktop variant additionally short-circuits when no token is cached — the
 * caller falls back to local storage rather than firing a doomed network request.
 */
export async function apiFetchJson<T = unknown>(input: RequestInfo, init?: RequestInit): Promise<T> {
    if (isTauri()) {
        const { getDesktopToken } = await import("./desktop-auth");
        const token = await getDesktopToken();
        if (!token) throw { message: "Not authenticated", status: 401 };
    }

    let response: Response;
    try {
        response = await apiFetch(input, init);
    } catch {
        throw { message: "Server unreachable", status: 0, isNetworkError: true };
    }

    const json = (await response.json()) as { data?: T; message?: string; status?: number };
    if (response.ok) return json.data as T;
    throw { ...json, status: response.status };
}
