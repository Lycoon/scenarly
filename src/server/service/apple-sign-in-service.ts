/**
 * Sign in with Apple from the macOS and iOS apps, where the system sheet
 * hands the app a signed credential instead of the browser round trip the
 * web flow makes through Auth.js.
 *
 * Both flows meet on the same Account row. Apple's `sub` is scoped to the
 * developer team, so the sheet names a user exactly as the web flow does, and
 * someone who first signed in on the website lands on the same account here.
 */

import * as AppleSignIn from "@src/lib/apple-sign-in";
import * as UserService from "@src/server/service/user-service";
import { UserRepository } from "@src/server/repository/user-repository";
import { isEmailAllowed } from "@src/lib/access-allowlist";
import { AppError, ForbiddenError } from "@src/lib/utils/api-utils";
import { logger } from "@src/lib/utils/logger";

const PROVIDER = "apple";

const repository = new UserRepository();

export interface NativeAppleSignIn {
    identityToken: string;
    authorizationCode: string;
    /** The raw nonce whose SHA-256 the app put on its request to Apple. */
    nonce: string;
}

/**
 * Resolve the user a native Sign in with Apple credential signs in as,
 * creating the account on a first sign-in.
 *
 * An Apple identity not seen before is attached to the account that already
 * has its email address, as the web flow does. Only the email inside the
 * signed token counts for that: one sent beside it by the app would let any
 * Apple ID claim any account.
 */
export async function signIn({ identityToken, authorizationCode, nonce }: NativeAppleSignIn) {
    let identity: AppleSignIn.AppleIdentity;
    try {
        identity = await AppleSignIn.verifyAppleIdentityToken(identityToken, nonce);
    } catch (e) {
        logger.warn("[AppleSignIn] Identity token rejected", { error: e });
        throw new ForbiddenError("This Sign in with Apple credential could not be verified.");
    }

    const linked = await repository.fetchUserByAccount(PROVIDER, identity.sub);

    const email = linked?.email ?? identity.email;
    if (!email) throw new AppError(422, "Apple did not share an email address for this account.");
    if (!isEmailAllowed(email)) throw new ForbiddenError("This address does not have access to this environment.");

    let user = linked;
    if (!user) {
        user = (await UserService.getUserFromEmail(email)) ?? (await UserService.createUser(email));
        await repository.createAccount(user.id, PROVIDER, identity.sub);
    }

    // The refresh token is only ever used to revoke the authorization when the
    // account is deleted, so failing to get one must not cost the sign-in.
    try {
        const tokens = await AppleSignIn.exchangeAppleCode(authorizationCode);
        await repository.updateAccountTokens(PROVIDER, identity.sub, tokens);
    } catch (e) {
        logger.error("[AppleSignIn] Could not store a refresh token", { userId: user.id, error: e });
    }

    return user;
}

/**
 * Revoke every Sign in with Apple authorization held for a user, which Apple
 * requires of an app when it deletes an account. Each failure is logged and
 * swallowed: an Apple outage must not stand in the way of a deletion.
 */
export async function revokeAllForDeletion(userId: string) {
    const accounts = await repository.fetchAccountTokens(userId, PROVIDER);

    for (const { refresh_token, id_token } of accounts) {
        if (!refresh_token) continue;
        try {
            await AppleSignIn.revokeAppleTokens({ refresh_token, id_token });
        } catch (e) {
            logger.error("[AppleSignIn] Could not revoke a refresh token", { userId, error: e });
        }
    }
}
