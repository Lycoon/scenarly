import { apiHandler } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import type { NextRequest } from "next/server";

import * as SignInCodeService from "@src/server/service/sign-in-code-service";
import { RequestSignInCodeBodySchema } from "@src/lib/utils/api-bodies";

/**
 * POST `/api/auth/sign-in-code`
 *
 * Emails a 6-digit sign-in code to the address, valid 10 minutes. Answers the
 * same whether or not the address is registered; at most 3 codes per address
 * every 10 minutes (429 `SIGN_IN_THROTTLED` beyond).
 *
 * `inviteToken` (optional): accepted along with the code, adding the user to
 * the project they were invited to.
 */
async function requestSignInCode(req: NextRequest) {
    const { email, inviteToken } = validate(RequestSignInCodeBodySchema, await req.json().catch(() => ({})));
    await SignInCodeService.sendCode(email, inviteToken ?? null);
    return Success(null);
}

export const POST = apiHandler(requestSignInCode);
