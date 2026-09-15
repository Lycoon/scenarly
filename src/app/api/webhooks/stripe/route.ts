import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "@src/lib/utils/logger";
import * as UserService from "@src/server/service/user-service";
import * as SubscriptionService from "@src/server/service/subscription-service";

export async function POST(req: NextRequest) {
    const stripe = SubscriptionService.getStripe();
    const sig = req.headers.get("stripe-signature") ?? "";
    const rawBody = await req.arrayBuffer();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            Buffer.from(rawBody),
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!,
        );
    } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const userId = session.client_reference_id;
            if (!userId || !session.subscription) break;

            const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            // The price on the subscription says which plan was bought.
            const priceId = subscription.items.data[0]?.price.id;
            const plan = priceId ? SubscriptionService.planForStripePrice(priceId) : null;
            if (!plan) {
                logger.warn("[Stripe webhook] Checkout for an unknown price", { userId, subscriptionId, priceId });
                break;
            }

            const customerId = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
            await UserService.updateUserFromId(userId, { stripeCustomerId: customerId });
            await SubscriptionService.activateStripe(userId, plan, subscription);
            break;
        }
        case "customer.subscription.updated":
            await SubscriptionService.syncStripe(event.data.object);
            break;
        case "customer.subscription.deleted":
            await SubscriptionService.endStripe(event.data.object.id);
            break;
    }

    return NextResponse.json({ received: true });
}
