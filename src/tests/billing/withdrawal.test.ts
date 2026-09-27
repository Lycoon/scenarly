import { describe, expect, it } from "vitest";
import { withdrawalDeadline, withdrawalRefund } from "@src/lib/withdrawal";

const at = (iso: string) => new Date(iso);

describe("withdrawalDeadline", () => {
    it("closes at the midnight after the 14th day following the purchase", () => {
        expect(withdrawalDeadline(at("2026-09-01T15:30:00Z")).toISOString()).toBe("2026-09-16T00:00:00.000Z");
    });

    it("counts from the purchase day even just before midnight", () => {
        expect(withdrawalDeadline(at("2026-09-01T23:59:00Z")).toISOString()).toBe("2026-09-16T00:00:00.000Z");
    });

    it("crosses month ends", () => {
        expect(withdrawalDeadline(at("2026-09-25T08:00:00Z")).toISOString()).toBe("2026-10-10T00:00:00.000Z");
    });
});

describe("withdrawalRefund", () => {
    const start = at("2026-09-01T10:00:00Z");
    const monthEnd = at("2026-10-01T10:00:00Z"); // 30 days
    const yearEnd = at("2027-09-01T10:00:00Z"); // 365 days

    it("keeps the first day as soon as the plan has started", () => {
        expect(withdrawalRefund(3000, start, monthEnd, at("2026-09-01T10:05:00Z"))).toBe(2900);
    });

    it("keeps one more day for every day started", () => {
        expect(withdrawalRefund(3000, start, monthEnd, at("2026-09-06T09:00:00Z"))).toBe(2500);
        expect(withdrawalRefund(3000, start, monthEnd, at("2026-09-06T11:00:00Z"))).toBe(2400);
    });

    it("gives the same amount all through one day, so the confirmed quote holds", () => {
        const morning = withdrawalRefund(4999, start, yearEnd, at("2026-09-10T10:30:00Z"));
        const evening = withdrawalRefund(4999, start, yearEnd, at("2026-09-11T09:59:00Z"));
        expect(morning).toBe(evening);
    });

    it("refunds most of a yearly plan withdrawn early", () => {
        // 3 of 365 days used.
        expect(withdrawalRefund(4990, start, yearEnd, at("2026-09-03T12:00:00Z"))).toBe(Math.floor((4990 * 362) / 365));
    });

    it("rounds down, never refunding more than was paid", () => {
        const refund = withdrawalRefund(999, start, monthEnd, at("2026-09-01T12:00:00Z"));
        expect(refund).toBe(965);
        expect(refund).toBeLessThanOrEqual(999);
    });

    it("refunds nothing once the whole period is used", () => {
        expect(withdrawalRefund(3000, start, monthEnd, at("2026-10-05T00:00:00Z"))).toBe(0);
    });
});
