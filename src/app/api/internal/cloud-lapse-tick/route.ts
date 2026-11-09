import { NextRequest } from "next/server";

import { apiHandler } from "@src/lib/utils/api-handler";
import { Success, UnauthorizedError } from "@src/lib/utils/api-utils";
import * as CloudLapseService from "@src/server/service/cloud-lapse-service";

import { jwtVerify } from "jose";

/**
 * POST `/api/internal/cloud-lapse-tick`
 *
 * The Cloud lapse scheduler. Fired every 15 minutes by the Worker's cron
 * trigger (see `scheduled()` in `src/lib/cloud/index.ts`) with a short-lived
 * Worker-signed JWT (`type: "cloud-lapse-tick"`), the same gate
 * `community-tick` uses. Locks the projects of owners whose Cloud plan ended,
 * sends their notices, deletes their media when due, and reopens the projects
 * of owners who have Cloud again.
 */
async function internalCloudLapseTick(req: NextRequest) {
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
    if (type !== "cloud-lapse-tick") throw new UnauthorizedError();

    return Success(await CloudLapseService.tick());
}

export const POST = apiHandler(internalCloudLapseTick);
