/**
 * Sign in with Apple, as the server talks to Apple about it: checking an
 * identity token the app was handed, trading an authorization code for a
 * refresh token, and revoking that token when the account is deleted.
 *
 * Apple knows this app under two client ids, and every token belongs to the
 * one that asked for it:
 *
 *  - the bundle id (`APPLE_BUNDLE_ID`), for the native sheet in the macOS and
 *    iOS apps. Its client secret is a short-lived JWT signed here with the
 *    Sign in with Apple key.
 *  - the Services ID (`AUTH_APPLE_ID`), for the web flow that Auth.js runs. Its
 *    client secret is the pre-generated `AUTH_APPLE_SECRET`.
 *
 * A token presented with the other client's credentials is refused, so the
 * calls below take or work out the client id. Server-side only.
 */

import crypto from "crypto";
import { createRemoteJWKSet, decodeJwt, jwtVerify, SignJWT } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.scenarly";

/** Apple's side of a sign-in is a few hundred ms; a stall must not hold up a sign-in or an account deletion. */
const REQUEST_TIMEOUT_MS = 10_000;

// Fetched on first use, then cached and refreshed by jose as Apple rotates keys.
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

interface AppleClientSecretConfig {
    teamId: string;
    clientId: string;
    keyId: string;
    privateKey: string;
    /** Seconds. Apple accepts up to six months. */
    expiresIn?: number;
}

/** An Apple client secret: a JWT signed with the Sign in with Apple key (.p8). */
export async function generateAppleJWT({
    teamId,
    clientId,
    keyId,
    privateKey,
    expiresIn = 86400 * 180,
}: AppleClientSecretConfig): Promise<string> {
    // The key arrives from an env file, where its newlines are escaped.
    const key = crypto.createPrivateKey(privateKey.replace(/\\n/g, "\n"));

    return new SignJWT({})
        .setAudience(APPLE_ISSUER)
        .setIssuer(teamId)
        .setIssuedAt()
        .setExpirationTime(Math.ceil(Date.now() / 1000) + expiresIn)
        .setSubject(clientId)
        .setProtectedHeader({ alg: "ES256", kid: keyId })
        .sign(key);
}

export interface AppleIdentity {
    /** Apple's id for the user. Scoped to the developer team, so the app and the website see the same one. */
    sub: string;
    /** Present, and verified by Apple, whenever the app asked for the email scope. */
    email: string | null;
}

/**
 * Check an identity token from the native Sign in with Apple sheet: signed by
 * Apple, issued to this app, and bound to this sign-in attempt. The app put
 * SHA-256(nonce) on its request and Apple copied it into the token, so a
 * token captured from another attempt fails here without its nonce.
 *
 * Throws when the token does not pass.
 */
export async function verifyAppleIdentityToken(identityToken: string, nonce: string): Promise<AppleIdentity> {
    const { payload } = await jwtVerify(identityToken, appleKeys, { issuer: APPLE_ISSUER, audience: BUNDLE_ID });

    const expectedNonce = crypto.createHash("sha256").update(nonce).digest("hex");
    if (payload.nonce !== expectedNonce) throw new Error("The identity token is bound to another nonce");
    if (!payload.sub) throw new Error("The identity token names no user");

    // Apple sends `email_verified` as a boolean or as the string "true".
    const verified = payload.email_verified === true || payload.email_verified === "true";
    const email = typeof payload.email === "string" && verified ? payload.email.toLowerCase().trim() : null;

    return { sub: payload.sub, email };
}

async function clientSecretFor(clientId: string): Promise<string> {
    if (clientId === process.env.AUTH_APPLE_ID) {
        if (!process.env.AUTH_APPLE_SECRET) throw new Error("AUTH_APPLE_SECRET is not configured");
        return process.env.AUTH_APPLE_SECRET;
    }
    if (clientId === BUNDLE_ID) {
        const { AUTH_APPLE_TEAM_ID, AUTH_APPLE_KEY_ID, AUTH_APPLE_PRIVATE_KEY } = process.env;
        if (!AUTH_APPLE_TEAM_ID || !AUTH_APPLE_KEY_ID || !AUTH_APPLE_PRIVATE_KEY) {
            throw new Error("AUTH_APPLE_TEAM_ID, AUTH_APPLE_KEY_ID and AUTH_APPLE_PRIVATE_KEY are not all configured");
        }
        return generateAppleJWT({
            teamId: AUTH_APPLE_TEAM_ID,
            clientId,
            keyId: AUTH_APPLE_KEY_ID,
            privateKey: AUTH_APPLE_PRIVATE_KEY,
            expiresIn: 300,
        });
    }
    throw new Error(`No Apple credentials for client ${clientId}`);
}

async function appleRequest(path: "token" | "revoke", clientId: string, params: Record<string, string>) {
    const response = await fetch(`${APPLE_ISSUER}/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: await clientSecretFor(clientId), ...params }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Apple answered ${response.status} on /auth/${path}: ${(await response.text()).slice(0, 200)}`);
    }
    return response;
}

/** The tokens Apple holds for one sign-in, in the shape the Account row keeps them. */
export interface AppleTokens {
    refresh_token: string;
    /** Kept beside the refresh token because its `aud` names the client the pair was issued to. */
    id_token: string | null;
}

/** Trade the authorization code from the native sheet for the tokens that go with it. */
export async function exchangeAppleCode(authorizationCode: string): Promise<AppleTokens> {
    const response = await appleRequest("token", BUNDLE_ID, {
        grant_type: "authorization_code",
        code: authorizationCode,
    });
    const { refresh_token, id_token } = (await response.json()) as { refresh_token?: string; id_token?: string };
    if (!refresh_token) throw new Error("Apple's token response carries no refresh token");
    return { refresh_token, id_token: id_token ?? null };
}

/**
 * Revoke a refresh token, which ends the user's Sign in with Apple
 * authorization for the client that holds it.
 *
 * The client is read off the id token stored with it. A row without one can
 * only have come from the web flow: the native route never stores a refresh
 * token without its id token.
 */
export async function revokeAppleTokens({ refresh_token, id_token }: AppleTokens): Promise<void> {
    const audience = id_token ? decodeJwt(id_token).aud : process.env.AUTH_APPLE_ID;
    const clientId = Array.isArray(audience) ? audience[0] : audience;
    if (!clientId) throw new Error("Cannot tell which Apple client the refresh token belongs to");

    await appleRequest("revoke", clientId, { token: refresh_token, token_type_hint: "refresh_token" });
}
