"use client";

import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "../../messages/en.json";

/**
 * Showcase renders in English whatever the viewer's language. Its content is
 * English-only and its pages are rendered on the server, where the locale
 * (kept in localStorage) is unknown: hydrating into the viewer's locale would
 * not match the server's HTML.
 */
const ShowcaseIntl = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
);

export default ShowcaseIntl;
