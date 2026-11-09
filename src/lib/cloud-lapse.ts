/**
 * What happens to an owner's cloud projects once their Cloud plan ends.
 *
 * From the lapse, every project they own is read-only for all its members, who
 * can still open, export and keep a local copy of it. The media (board images
 * and audio recordings) is kept for `MEDIA_RETENTION_DAYS`, then deleted; the
 * scripts are kept for as long as the account exists. Cloud again, through a
 * renewal or by handing a project to a member who has it, lifts all of this.
 *
 * Pure and free of server imports: the scheduler (cloud-lapse-service) and the
 * browser, which shows the deletion date, read the same rules. The schedule is
 * counted in days of `dayMs`, a real day unless staging shortens it to watch a
 * whole lapse go by (see cloud-lapse-service).
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nothing is locked or deleted before this. The Terms (section 21) promise 30
 * days' notice of a change that materially affects a paid plan, and this one
 * replaced "cloud projects are not deleted when a plan ends". Owners already
 * lapsed by then get their full notice period counted from this date.
 */
export const CLOUD_LAPSE_EFFECTIVE_AT = new Date("2026-12-10T00:00:00Z");

export const isCloudLapseInEffect = (now: Date) => now.getTime() >= CLOUD_LAPSE_EFFECTIVE_AT.getTime();

export const MEDIA_RETENTION_DAYS = 90;

/** The reminders before the media goes, in days ahead of it. Notice 1 is the lapse itself. */
export const REMINDER_LEAD_DAYS = [30, 7] as const;

/** The last reminder never comes later than this before the date it announces. */
const FINAL_NOTICE_DAYS = REMINDER_LEAD_DAYS[REMINDER_LEAD_DAYS.length - 1];

export const LAPSE_NOTICE = 1;
export const FINAL_NOTICE = LAPSE_NOTICE + REMINDER_LEAD_DAYS.length;

/** How a lapsed owner's projects look to their members. */
export type CloudLock = {
    /** ISO date the media is deleted on; null when there is none to delete (never any, or already gone). */
    mediaDeletesAt: string | null;
};

/** The projects a lapse notice names, and those of them whose media will be deleted. */
export type NoticeProjects = { titles: string[]; mediaTitles: string[] };

export type LapseState = { mediaDeletesAt: Date; noticesSent: number; mediaDeletedAt: Date | null };

export const mediaDeletionDate = (lapsedAt: Date, dayMs = DAY_MS) =>
    new Date(lapsedAt.getTime() + MEDIA_RETENTION_DAYS * dayMs);

/**
 * The reminder due now, if any: the latest one whose lead has been reached, so
 * a scheduler that was down skips straight to the one that still makes sense
 * rather than announcing "30 days left" a week before. Null once the final one
 * has gone out or the media is already gone.
 */
export function dueReminder(
    lapse: LapseState,
    now: Date,
    dayMs = DAY_MS,
): { notice: number; leadDays: number } | null {
    if (lapse.mediaDeletedAt || lapse.noticesSent < LAPSE_NOTICE) return null;
    for (let i = REMINDER_LEAD_DAYS.length - 1; i >= 0; i--) {
        const notice = LAPSE_NOTICE + 1 + i;
        if (lapse.noticesSent >= notice) return null;
        if (now.getTime() >= lapse.mediaDeletesAt.getTime() - REMINDER_LEAD_DAYS[i] * dayMs) {
            return { notice, leadDays: REMINDER_LEAD_DAYS[i] };
        }
    }
    return null;
}

/**
 * When the media goes, given that the final reminder is being sent now: never
 * less than a week out, so the date it names is one the reader can still act on.
 */
export const deletionDateAfterFinalNotice = (mediaDeletesAt: Date, now: Date, dayMs = DAY_MS) =>
    new Date(Math.max(mediaDeletesAt.getTime(), now.getTime() + FINAL_NOTICE_DAYS * dayMs));

/** The media is deleted only once its date has come and every notice has gone out. */
export const isMediaDeletionDue = (lapse: LapseState, now: Date) =>
    !lapse.mediaDeletedAt && lapse.noticesSent >= FINAL_NOTICE && now.getTime() >= lapse.mediaDeletesAt.getTime();
