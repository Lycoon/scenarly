import { NextRequest } from "next/server";
import z from "zod";

import * as UserService from "@src/server/service/user-service";
import * as SubscriptionService from "@src/server/service/subscription-service";
import { Success, UserNotFoundError, validate } from "@src/lib/utils/api-utils";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { assertAdmin } from "@src/lib/utils/admin-guard";
import { GrantPlanBodySchema, PlanBodySchema } from "@src/lib/utils/api-bodies";

const ParamsSchema = z.object({ userId: z.string().min(1) });

async function resolveTarget({ routeParams, user }: AuthApiContext) {
    await assertAdmin(user);
    const { userId } = validate(ParamsSchema, routeParams);
    if (!(await UserService.getUserFromId(userId))) throw new UserNotFoundError();
    return userId;
}

/** Give the user a plan for free until `expiresAt`, or move an existing grant's end. */
async function grantPlan(req: NextRequest, context: AuthApiContext) {
    const userId = await resolveTarget(context);
    const { plan, expiresAt } = validate(GrantPlanBodySchema, await req.json().catch(() => ({})));
    await SubscriptionService.grantPlan(userId, plan, expiresAt);
    return Success(null);
}

/** Take a granted plan back now. */
async function revokeGrant(req: NextRequest, context: AuthApiContext) {
    const userId = await resolveTarget(context);
    const { plan } = validate(PlanBodySchema, await req.json().catch(() => ({})));
    await SubscriptionService.revokeGrant(userId, plan);
    return Success(null);
}

export const POST = apiHandler(grantPlan);
export const DELETE = apiHandler(revokeGrant);
