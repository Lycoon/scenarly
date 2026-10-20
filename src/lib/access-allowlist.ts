/**
 * Who may use a restricted environment (staging). `ACCESS_ALLOWLIST` holds a
 * comma-separated list of emails; unset or empty, everyone may (production).
 *
 * Checked where a session is made (sign-in code request, OAuth `signIn`) and
 * where one is read (proxy, `getCookieUser`), so a session minted before an
 * address left the list stops working too. Gating accounts rather than the
 * reverse proxy keeps webhooks, Worker callbacks, CORS preflights and the
 * desktop `Authorization: Bearer` header working untouched.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
    const raw = process.env.ACCESS_ALLOWLIST?.trim();
    if (!raw) return true;
    if (!email) return false;
    const normalized = email.toLowerCase().trim();
    return raw.split(",").some((entry) => entry.toLowerCase().trim() === normalized);
}
