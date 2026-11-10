import { describe, expect, it } from "vitest";
import {
    CLOUD_LAPSE_EFFECTIVE_AT,
    DAY_MS,
    deletionDateAfterFinalNotice,
    dueReminder,
    FINAL_NOTICE,
    isCloudLapseInEffect,
    isMediaDeletionDue,
    LAPSE_NOTICE,
    mediaDeletionDate,
} from "@src/lib/cloud-lapse";

const at = (iso: string) => new Date(iso);

const lapsedAt = at("2026-11-01T10:00:00Z");
const deletesAt = mediaDeletionDate(lapsedAt);
const lapse = (noticesSent: number, mediaDeletesAt = deletesAt, mediaDeletedAt: Date | null = null) => ({
    mediaDeletesAt,
    noticesSent,
    mediaDeletedAt,
});

describe("mediaDeletionDate", () => {
    it("falls 90 days after the lapse", () => {
        expect(deletesAt.toISOString()).toBe("2027-01-30T10:00:00.000Z");
    });
});

describe("dueReminder", () => {
    it("sends nothing before the lapse notice is out", () => {
        expect(dueReminder(lapse(0), at("2027-01-29T00:00:00Z"))).toBeNull();
    });

    it("sends nothing until 30 days are left", () => {
        expect(dueReminder(lapse(LAPSE_NOTICE), at("2026-12-31T09:59:00Z"))).toBeNull();
    });

    it("sends the 30-day reminder once 30 days are left", () => {
        expect(dueReminder(lapse(LAPSE_NOTICE), at("2026-12-31T10:00:00Z"))).toEqual({ notice: 2, leadDays: 30 });
    });

    it("sends the 7-day reminder after the 30-day one", () => {
        expect(dueReminder(lapse(2), at("2027-01-23T10:00:00Z"))).toEqual({ notice: 3, leadDays: 7 });
    });

    it("skips the 30-day reminder when a week or less is left", () => {
        expect(dueReminder(lapse(LAPSE_NOTICE), at("2027-01-25T00:00:00Z"))).toEqual({ notice: 3, leadDays: 7 });
    });

    it("sends nothing once the final reminder is out", () => {
        expect(dueReminder(lapse(FINAL_NOTICE), at("2027-01-29T00:00:00Z"))).toBeNull();
    });

    it("sends nothing once the media is gone", () => {
        expect(dueReminder(lapse(LAPSE_NOTICE, deletesAt, deletesAt), at("2027-02-10T00:00:00Z"))).toBeNull();
    });
});

describe("deletionDateAfterFinalNotice", () => {
    it("keeps the date when the reminder is on time", () => {
        expect(deletionDateAfterFinalNotice(deletesAt, at("2027-01-23T10:00:00Z"))).toEqual(deletesAt);
    });

    it("pushes the date a week out when the reminder is late", () => {
        expect(deletionDateAfterFinalNotice(deletesAt, at("2027-01-29T00:00:00Z")).toISOString()).toBe(
            "2027-02-05T00:00:00.000Z",
        );
    });
});

describe("isMediaDeletionDue", () => {
    it("waits for the date", () => {
        expect(isMediaDeletionDue(lapse(FINAL_NOTICE), at("2027-01-30T09:59:00Z"))).toBe(false);
    });

    it("is due on the date once every notice is out", () => {
        expect(isMediaDeletionDue(lapse(FINAL_NOTICE), at("2027-01-30T10:00:00Z"))).toBe(true);
    });

    it("never deletes before the final reminder", () => {
        expect(isMediaDeletionDue(lapse(2), at("2027-03-01T00:00:00Z"))).toBe(false);
    });

    it("deletes only once", () => {
        expect(isMediaDeletionDue(lapse(FINAL_NOTICE, deletesAt, deletesAt), at("2027-03-01T00:00:00Z"))).toBe(false);
    });
});

describe("isCloudLapseInEffect", () => {
    it("waits for the date the Terms announce", () => {
        expect(isCloudLapseInEffect(new Date(CLOUD_LAPSE_EFFECTIVE_AT.getTime() - 1))).toBe(false);
        expect(isCloudLapseInEffect(CLOUD_LAPSE_EFFECTIVE_AT)).toBe(true);
    });
});

describe("a shortened day", () => {
    const minute = 60 * 1000;
    const day = 2 * minute;
    const deletesAtSoon = mediaDeletionDate(lapsedAt, day);

    it("scales the retention", () => {
        expect(deletesAtSoon.getTime() - lapsedAt.getTime()).toBe(180 * minute);
        expect(DAY_MS).toBe(24 * 60 * minute);
    });

    it("scales the reminders", () => {
        const at = (minutes: number) => new Date(lapsedAt.getTime() + minutes * minute);
        expect(dueReminder(lapse(LAPSE_NOTICE, deletesAtSoon), at(119), day)).toBeNull();
        expect(dueReminder(lapse(LAPSE_NOTICE, deletesAtSoon), at(120), day)).toEqual({ notice: 2, leadDays: 30 });
        expect(dueReminder(lapse(2, deletesAtSoon), at(166), day)).toEqual({ notice: 3, leadDays: 7 });
    });

    it("scales the final notice's minimum", () => {
        const late = new Date(deletesAtSoon.getTime());
        expect(deletionDateAfterFinalNotice(deletesAtSoon, late, day).getTime() - late.getTime()).toBe(14 * minute);
    });
});
