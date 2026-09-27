import { NextRequest } from "next/server";
import { createTranslator } from "next-intl";
import { apiHandler, AuthApiContext } from "@src/lib/utils/api-handler";
import { Success, validate } from "@src/lib/utils/api-utils";
import { CheckoutBodySchema } from "@src/lib/utils/api-bodies";
import * as UserService from "@src/server/service/user-service";
import * as SubscriptionService from "@src/server/service/subscription-service";
import { PLAN_NAMES } from "@src/lib/plans";
import type { UserLanguage } from "@src/lib/utils/types";

import enMessages from "../../../../../messages/en.json";
import esMessages from "../../../../../messages/es.json";
import frMessages from "../../../../../messages/fr.json";
import zhMessages from "../../../../../messages/zh.json";
import koMessages from "../../../../../messages/ko.json";
import jaMessages from "../../../../../messages/ja.json";
import deMessages from "../../../../../messages/de.json";
import plMessages from "../../../../../messages/pl.json";

const MESSAGES: Record<UserLanguage, typeof enMessages> = {
    en: enMessages, es: esMessages, fr: frMessages, zh: zhMessages, ko: koMessages, ja: jaMessages, de: deMessages, pl: plMessages,
};

const TERMS_URL = `${process.env.NEXT_PUBLIC_API_URL || "https://scenarly.com"}/terms`;

async function createCheckoutSession(req: NextRequest, { user }: AuthApiContext) {
    const { plan, period, redirectBase, language = "en" } = validate(
        CheckoutBodySchema,
        await req.json().catch(() => ({})),
    );
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
        // A required checkbox: agreeing to the Terms, and asking for the plan
        // to start at once, which is what lets a withdrawal within 14 days
        // keep the days already used (Code de la consommation, L.221-25).
        // Stripe needs the Terms URL in the Dashboard's public details too.
        consent_collection: { terms_of_service: "required" },
        custom_text: {
            terms_of_service_acceptance: {
                message: createTranslator({
                    locale: language,
                    messages: MESSAGES[language],
                    namespace: "profile.subscription",
                })("checkoutConsent", { plan: PLAN_NAMES[plan], termsUrl: TERMS_URL }),
            },
        },
        success_url: `${baseUrl}/projects?subscribed=${plan}`,
        cancel_url: `${baseUrl}/projects`,
    });

    return Success({ url: session.url });
}

export const POST = apiHandler(createCheckoutSession);
