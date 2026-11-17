import { NextRequest } from "next/server";

import { apiHandler } from "@src/lib/utils/api-handler";
import { readBody, Success, validate } from "@src/lib/utils/api-utils";
import { AppleNativeSignInBodySchema } from "@src/lib/utils/api-bodies";
import { encodeDesktopBearer } from "@src/lib/auth-tokens";
import * as AppleSignInService from "@src/server/service/apple-sign-in-service";

/**
 * POST `/api/auth/apple/native`
 *
 * Sign in with Apple for the macOS and iOS apps, which App Review requires to
 * finish inside the app. The system sheet hands the app a credential signed
 * by Apple; this checks it and answers `{ token }`, the same bearer JWE the
 * browser bridge (/api/desktop/token) and the email code route issue.
 */
async function appleNativeSignIn(req: NextRequest) {
    const credential = validate(AppleNativeSignInBodySchema, await readBody(req));
    const user = await AppleSignInService.signIn(credential);

    const token = await encodeDesktopBearer({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
    });

    return Success({ token });
}

export const POST = apiHandler(appleNativeSignIn);
