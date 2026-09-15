import { getUserFromId } from "@src/server/service/user-service";
import { hasActivePlan, Plan, PLAN_NAMES } from "@src/lib/plans";
import { PaymentRequiredError } from "./api-utils";

/** Server-side gate for a route that needs a plan on the calling (or owning) account. */
export async function requirePlan(userId: string, plan: Plan): Promise<void> {
    const user = await getUserFromId(userId);
    if (!user || !hasActivePlan(user, plan)) {
        throw new PaymentRequiredError(`${PLAN_NAMES[plan]} subscription required`);
    }
}

export const requireCloudPlan = (userId: string) => requirePlan(userId, "CLOUD");
