/**
 * A rough guess at the currency to show Stripe prices in, from the browser's
 * own locale — there is no IP geolocation in this app. Imperfect (a traveller
 * or a non-regional browser locale won't match their card's billing country),
 * but good enough for a display price; Stripe itself decides the currency
 * actually charged at checkout.
 */
const REGION_CURRENCY: Record<string, string> = {
    US: "USD", PR: "USD",
    CA: "CAD",
    GB: "GBP",
    CH: "CHF", LI: "CHF",
    JP: "JPY",
    AU: "AUD",
    NZ: "NZD",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    RO: "RON",
    BG: "BGN",
    MX: "MXN",
    BR: "BRL",
    IN: "INR",
    SG: "SGD",
    HK: "HKD",
    ZA: "ZAR",
    KR: "KRW",
    CN: "CNY",
    AE: "AED",
    SA: "SAR",
    IL: "ILS",
    TR: "TRY",
    // Eurozone.
    DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR",
    IE: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
    EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", MT: "EUR", HR: "EUR", AD: "EUR",
    MC: "EUR", SM: "EUR", VA: "EUR",
};

export const guessUserCurrency = (): string | undefined => {
    if (typeof navigator === "undefined") return undefined;
    try {
        const region = new Intl.Locale(navigator.language).maximize().region;
        return region ? REGION_CURRENCY[region] : undefined;
    } catch {
        return undefined;
    }
};
