/**
 * Google Play Billing, as the server sees it.
 *
 * Unlike Apple's, a Play purchase is not a signed document the app can hand
 * over: the app only gets a purchase token, and what that token bought, until
 * when, and whether it renews is asked of Google itself through the Play
 * Developer API (`purchases.subscriptionsv2`). Asking under this server's own
 * package name is what proves the token is a real purchase of this app.
 *
 * The API is called as a service account (Play Console → Users and
 * permissions, with "View financial data" and "Manage orders and
 * subscriptions"), authenticated by a self-signed JWT exchanged for an access
 * token. Real-time developer notifications reach us as Cloud Pub/Sub pushes,
 * which carry a Google-signed OIDC token checked here too. Server-side only.
 */

import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { AppError } from "@src/lib/utils/api-utils";
import { GooglePurchase, parseSubscription, SubscriptionPurchaseV2 } from "@src/lib/google-play-purchase";

/** The Play app this server serves: `com.scenarly`, or `com.scenarly.staging` on the staging server. */
export const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.scenarly";

const API_BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases`;
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

/**
 * A rejected or unverifiable Play purchase. 403 when Google does not know
 * the token for this app; 503 when the check could not run (Google
 * unreachable, or this server not configured) — Pub/Sub redelivers a push
 * that answers 5xx, and the app can simply try again.
 */
export class GooglePlayError extends AppError {
    constructor(public readonly reason: string, retryable = false) {
        super(retryable ? 503 : 403, `Google Play purchase rejected: ${reason}`);
        Object.setPrototypeOf(this, GooglePlayError.prototype);
    }
}

type ServiceAccount = { client_email: string; private_key: string; private_key_id?: string };

let serviceAccount: ServiceAccount | undefined;
let accessToken: { value: string; expiresAt: number } | undefined;

function getServiceAccount(): ServiceAccount {
    if (serviceAccount) return serviceAccount;
    const encoded = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
    if (!encoded) throw new GooglePlayError("GOOGLE_PLAY_SERVICE_ACCOUNT is not configured", true);
    try {
        // The service account's JSON key, base64-encoded so it fits on one env line.
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString()) as Partial<ServiceAccount>;
        if (!parsed.client_email || !parsed.private_key) throw new Error("missing client_email or private_key");
        return (serviceAccount = parsed as ServiceAccount);
    } catch (e) {
        throw new GooglePlayError(`GOOGLE_PLAY_SERVICE_ACCOUNT is not a base64 service account key (${String(e)})`, true);
    }
}

/** An OAuth access token for the Play Developer API, reused until shortly before it expires. */
async function getAccessToken(): Promise<string> {
    if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;

    const account = getServiceAccount();
    const assertion = await new SignJWT({ scope: SCOPE })
        .setProtectedHeader({ alg: "RS256", typ: "JWT", ...(account.private_key_id ? { kid: account.private_key_id } : {}) })
        .setIssuer(account.client_email)
        .setAudience("https://oauth2.googleapis.com/token")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(await importPKCS8(account.private_key, "RS256"));

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    }).catch(() => null);
    if (!res?.ok) throw new GooglePlayError(`could not authenticate to Google (${res?.status ?? "unreachable"})`, true);

    const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
    accessToken = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
    return access_token;
}

async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json", ...init.headers },
    }).catch(() => null);
    if (!res) throw new GooglePlayError("Google Play is unreachable", true);
    // A token this app never issued (or one from the other Play app) is unknown here.
    if (res.status === 400 || res.status === 404 || res.status === 410) {
        throw new GooglePlayError(`unknown purchase token (${res.status})`);
    }
    // 401/403 mean this server's credentials or permissions are wrong, not the purchase.
    if (!res.ok) throw new GooglePlayError(`Google Play answered ${res.status}`, true);
    return res;
}

/** The subscription behind a purchase token, as Google has it now. */
export async function getGooglePurchase(purchaseToken: string): Promise<GooglePurchase> {
    const res = await callApi(`/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
    const purchase = parseSubscription(purchaseToken, (await res.json()) as SubscriptionPurchaseV2);
    if (!purchase) throw new GooglePlayError("subscription has no product");
    return purchase;
}

/** Confirm we granted the purchase. Google refunds a subscription left unacknowledged for 3 days. */
export async function acknowledgeGooglePurchase(purchase: GooglePurchase): Promise<void> {
    await callApi(
        `/subscriptions/${encodeURIComponent(purchase.productId)}/tokens/${encodeURIComponent(purchase.purchaseToken)}:acknowledge`,
        { method: "POST", body: "{}" },
    );
}

/** Stop the subscription from renewing; it stays valid until the end of the period paid for. */
export async function cancelGooglePurchase(productId: string, purchaseToken: string): Promise<void> {
    await callApi(`/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:cancel`, {
        method: "POST",
    });
}

const GOOGLE_CERTS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * Whether a Pub/Sub push really comes from our subscription: Pub/Sub signs an
 * OIDC token as the service account set on the push subscription, for the
 * audience set there. Both must be configured, or every push is refused.
 */
export async function isGooglePushAuthentic(authorization: string | null): Promise<boolean> {
    const audience = process.env.GOOGLE_PLAY_PUSH_AUDIENCE;
    const pushAccount = process.env.GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT;
    if (!audience || !pushAccount || !authorization?.startsWith("Bearer ")) return false;
    try {
        const { payload } = await jwtVerify(authorization.slice(7), GOOGLE_CERTS, {
            issuer: ["https://accounts.google.com", "accounts.google.com"],
            audience,
        });
        return payload.email === pushAccount && payload.email_verified === true;
    } catch {
        return false;
    }
}
