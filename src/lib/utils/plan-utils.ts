import { getUserFromId } from "@src/server/service/user-service";
import { getProjectOwnerId } from "@src/server/service/project-service";
import { hasActivePlan, Plan, PLAN_NAMES } from "@src/lib/plans";
import { InternalServerError, PaymentRequiredError } from "./api-utils";

/** Server-side gate for a route that needs a plan on the calling (or owning) account. */
export async function requirePlan(userId: string, plan: Plan): Promise<void> {
    const user = await getUserFromId(userId);
    if (!user || !hasActivePlan(user, plan)) {
        throw new PaymentRequiredError(`${PLAN_NAMES[plan]} subscription required`);
    }
}

export const requireCloudPlan = (userId: string) => requirePlan(userId, "CLOUD");

/**
 * Gate for a write to a cloud project: the owner's Cloud plan covers the whole
 * project, whoever the caller is. Without it the project is read-only for
 * every member (see cloud-lapse-service), whether or not they have Cloud.
 */
export async function requireProjectCloudPlan(projectId: string): Promise<void> {
    const ownerId = await getProjectOwnerId(projectId);
    if (!ownerId) throw new InternalServerError();
    await requireCloudPlan(ownerId);
}
