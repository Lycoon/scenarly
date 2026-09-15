import { Plan, SubscriptionProvider } from "../../generated/client/client";
import prisma from "../db";

export interface SubscriptionWrite {
    provider: SubscriptionProvider;
    providerId: string;
    expiresAt: Date;
    cancelled: boolean;
}

export class SubscriptionRepository {
    fetchByUser(userId: string) {
        return prisma.subscription.findMany({
            where: { userId },
            select: { plan: true, provider: true, providerId: true, expiresAt: true, cancelled: true },
        });
    }

    /** The row a store event belongs to, with the owner's email for the "linked to another account" message. */
    fetchByProviderId(provider: SubscriptionProvider, providerId: string) {
        return prisma.subscription.findUnique({
            where: { provider_providerId: { provider, providerId } },
            select: {
                userId: true,
                plan: true,
                provider: true,
                providerId: true,
                expiresAt: true,
                cancelled: true,
                user: { select: { email: true } },
            },
        });
    }

    /** Replace whatever backs `plan` for this user — a plan bought again, or through the other store. */
    upsert(userId: string, plan: Plan, data: SubscriptionWrite) {
        return prisma.subscription.upsert({
            where: { userId_plan: { userId, plan } },
            create: { userId, plan, ...data },
            update: data,
        });
    }

    update(userId: string, plan: Plan, data: Partial<Pick<SubscriptionWrite, "expiresAt" | "cancelled">>) {
        return prisma.subscription.update({ where: { userId_plan: { userId, plan } }, data });
    }

    delete(userId: string, plan: Plan) {
        return prisma.subscription.delete({ where: { userId_plan: { userId, plan } } });
    }

    countActive(plan: Plan, now: Date = new Date()) {
        return prisma.subscription.count({ where: { plan, expiresAt: { gt: now } } });
    }
}
