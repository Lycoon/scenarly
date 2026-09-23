import { NextRequest } from "next/server";

import { apiHandler } from "@src/lib/utils/api-handler";
import { Success, UnauthorizedError } from "@src/lib/utils/api-utils";
import * as CommunityJobsService from "@src/server/service/community-jobs-service";

import { jwtVerify } from "jose";

/**
 * POST `/api/internal/community-tick`
 *
 * The Community scheduler. Fired every 15 minutes by the Worker's cron trigger
 * (see `scheduled()` in `src/lib/cloud/index.ts`) with a short-lived
 * Worker-signed JWT (`type: "community-tick"`), the same gate `asset-gc` uses.
 * Expires claims, auto-sends drafts past the 7-day floor, retires pooled
 * submissions, sends deadline reminders and reclaims R2 objects.
 */
async function internalCommunityTick(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) throw new UnauthorizedError();

    let type: unknown;
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!));
        type = payload.type;
    } catch {
        throw new UnauthorizedError();
    }
    if (type !== "community-tick") throw new UnauthorizedError();

    return Success(await CommunityJobsService.tick());
}

export const POST = apiHandler(internalCommunityTick);
