import { NextRequest } from "next/server";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { CheckoutBodySchema } from "@src/lib/utils/api-bodies";
import * as UserService from "@src/server/service/user-service";
import * as SubscriptionService from "@src/server/service/subscription-service";

async function createCheckoutSession(req: NextRequest, { user }: AuthApiContext) {
    const { plan, period, redirectBase } = validate(CheckoutBodySchema, await req.json().catch(() => ({})));
    const baseUrl = redirectBase || (process.env.NEXT_PUBLIC_API_URL ?? "");

    SubscriptionService.assertOnSale(plan);
    // A live subscription for this plan — Stripe or Apple — must not be
    // doubled up. A cancelled-but-running Stripe one is resumed through
    // /api/stripe/resume instead.
    await SubscriptionService.assertNotSubscribed(user.id, plan);

    // A returning subscriber checks out on their existing Stripe customer
    // (payment method and invoice history intact) instead of spawning a new one.
    const stripeCustomerId = await UserService.getStripeCustomerId(user.id);

    const session = await SubscriptionService.getStripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: SubscriptionService.stripePriceFor(plan, period), quantity: 1 }],
        client_reference_id: user.id,
        ...(stripeCustomerId
            ? // With an existing customer, Checkout only writes the details it
              // collects back onto them when told to; the invoice reads them from there.
              { customer: stripeCustomerId, customer_update: { address: "auto", name: "auto" } }
            : { customer_email: user.email }),
        // French invoicing rules: every invoice carries the customer's name and
        // billing address, VAT follows the customer's country (Stripe Tax does
        // the arithmetic and the registrations configured in the Dashboard
        // decide the rate), and a business customer's VAT number is printed
        // so intra-EU B2B sales can be reverse-charged.
        billing_address_collection: "required",
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
        locale: "auto",
        success_url: `${baseUrl}/projects?subscribed=${plan}`,
        cancel_url: `${baseUrl}/projects`,
    });

    return Success({ url: session.url });
}

export const POST = apiHandler(createCheckoutSession);
