import { NextRequest } from "next/server";
import z from "zod";
import { apiHandler, ApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { PLANS } from "@src/lib/plans";
import * as SubscriptionService from "@src/server/service/subscription-service";

const QuerySchema = z.object({
    plan: z.enum(PLANS),
    currency: z.string().trim().toLowerCase().length(3).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
});

async function getPrices(_req: NextRequest, { searchParams }: ApiContext) {
    const { plan, currency, locale } = validate(QuerySchema, searchParams);
    const prices = await SubscriptionService.stripeDisplayPrices(plan, currency, locale ?? "en");
    return Success(prices);
}

export const GET = apiHandler(getPrices);
