import { apiHandler } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { NextResponse, type NextRequest } from "next/server";

import * as UserService from "@src/server/service/user-service";
import * as ProjectService from "@src/server/service/project-service";
import * as SignInCodeService from "@src/server/service/sign-in-code-service";
import * as Misc from "@src/lib/utils/misc";
import * as CollabUtils from "@src/lib/cloud/utils";
import {
    encodeDesktopBearer,
    encodeWebSessionCookie,
    SESSION_TTL_SECONDS,
    type EncodedTokenPayload,
} from "@src/lib/auth-tokens";

import { VerifySignInCodeBodySchema } from "@src/lib/utils/api-bodies";

/**
 * POST `/api/auth/sign-in-code/verify`
 *
 * Spends a sign-in code (see sign-in-code-service for the guessing limits)
 * and signs the caller in, creating the account on a first sign-in:
 *
 *   - Web: sets the NextAuth session cookie; answers `null`.
 *   - Desktop and mobile apps (`desktop: true`): answers `{ token }`, the
 *     bearer JWE the app keeps in its secure store.
 */
async function verifySignInCode(req: NextRequest) {
    const { email, code, desktop } = validate(VerifySignInCodeBodySchema, await req.json().catch(() => ({})));
    const { inviteToken } = await SignInCodeService.consumeCode(email, code);

    let user = await UserService.getUserFromEmail(email);
    if (!user) {
        user = await UserService.createUser(email);
    } else if (!user.emailVerified) {
        await UserService.setVerified(user.id);
    }

    // Best-effort invite acceptance — never let an invite failure block sign-in.
    if (inviteToken) {
        try {
            const invite = await ProjectService.getInvite(inviteToken);
            if (invite && invite.email.toLowerCase() === email && !Misc.hasExpired(invite.createdAt, 7, "days")) {
                await ProjectService.upsertMember(invite.projectId, user.id);
                await ProjectService.deleteInviteFromToken(inviteToken);
                // Clear any leftover DO blacklist entry from a prior kick so
                // the freshly re-invited user can actually open a WS to the
                // project room (otherwise the upgrade returns 403 forever).
                try {
                    await CollabUtils.allowOnWebsocket(user.id, invite.projectId);
                } catch (err) {
                    console.error("[sign-in-code] Failed to clear blacklist:", err);
                }
            }
        } catch (err) {
            console.error("[sign-in-code] Invite acceptance failed:", err);
        }
    }

    const tokenPayload: EncodedTokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
    };

    if (desktop) return Success({ token: await encodeDesktopBearer(tokenPayload) });

    const { jwe, name, secure } = await encodeWebSessionCookie(tokenPayload);
    const response = NextResponse.json({ status: "success", data: null }, { status: 200 });
    response.cookies.set({
        name,
        value: jwe,
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    });
    return response;
}

export const POST = apiHandler(verifySignInCode);
