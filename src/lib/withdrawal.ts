/**
 * The EU right of withdrawal on a Stripe subscription, as plain arithmetic.
 * Kept free of Stripe and server imports so it can be tested on its own; the
 * subscription service feeds it Stripe's dates and amounts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const WITHDRAWAL_DAYS = 14;

/**
 * The 14-day period runs from the day after the subscription was taken and
 * ends with the 14th day, so it closes at the midnight (UTC) that follows: a
 * little generous for a European customer, never short. Exclusive.
 */
export function withdrawalDeadline(start: Date): Date {
    const deadline = new Date(start);
    deadline.setUTCHours(0, 0, 0, 0);
    deadline.setUTCDate(deadline.getUTCDate() + WITHDRAWAL_DAYS + 1);
    return deadline;
}

/**
 * What a withdrawal refunds of `amountPaid` (smallest currency unit) for a
 * billing period running from `periodStart` to `periodEnd`. The plan starts at
 * the customer's request, so the days already used are kept: whole days, the
 * current one counting as used, and rounded down so it never refunds more than
 * was paid. Counting whole days keeps the amount the same between the quote the
 * user confirms and the refund itself.
 */
export function withdrawalRefund(amountPaid: number, periodStart: Date, periodEnd: Date, now: Date): number {
    const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS));
    const usedDays = Math.min(totalDays, Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / DAY_MS)));
    return Math.floor((amountPaid * (totalDays - usedDays)) / totalDays);
}
