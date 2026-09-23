/** Date and duration formatting shared by the Community components. */

export const formatDate = (iso: string | Date | null | undefined, withTime = false): string => {
    if (!iso) return "";
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(withTime && { hour: "2-digit", minute: "2-digit" }),
    });
};

/** Whole days from now to `iso`, negative when in the past. */
export const daysUntil = (iso: string | Date): number => {
    const target = typeof iso === "string" ? new Date(iso) : iso;
    return Math.ceil((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};
