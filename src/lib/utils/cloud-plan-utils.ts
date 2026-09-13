import { getUserFromId } from "@src/server/service/user-service";
import { PaymentRequiredError } from "./api-utils";

export function isCloudPlanActive(cloudPlanUntil: Date | null | undefined): boolean {
    return !!cloudPlanUntil && cloudPlanUntil > new Date();
}

export async function requireCloudPlan(userId: string): Promise<void> {
    const user = await getUserFromId(userId);
    if (!user || !isCloudPlanActive(user.cloudPlanUntil)) {
        throw new PaymentRequiredError();
    }
}
