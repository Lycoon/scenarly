import { NextRequest } from "next/server";

import * as UserService from "@src/server/service/user-service";
import * as ProjectService from "@src/server/service/project-service";
import { SubscriptionRepository } from "@src/server/repository/subscription-repository";
import { Success } from "@src/lib/utils/api-utils";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { assertAdmin } from "@src/lib/utils/admin-guard";

async function getStats(req: NextRequest, { user }: AuthApiContext) {
    await assertAdmin(user);

    const subscriptions = new SubscriptionRepository();
    const [userCount, activeCloudPlanCount, projectCount] = await Promise.all([
        UserService.countUsers(),
        subscriptions.countActive("CLOUD"),
        ProjectService.countProjects(),
    ]);

    return Success({
        userCount,
        activeCloudPlanCount,
        projectCount,
    });
}

export const GET = apiHandler(getStats);
