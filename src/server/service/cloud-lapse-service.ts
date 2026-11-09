/**
 * Cloud projects whose owner no longer has Cloud (the rules: `src/lib/cloud-lapse`).
 *
 * The plan running out is not an event any store sends us on time, so a tick
 * fired every 15 minutes by the Worker's cron (`/api/internal/cloud-lapse-tick`)
 * notices it: it locks the owner's project rooms, drops their pending
 * invitations, tells the owner and every collaborator, sends the reminders,
 * and deletes the media once its date has come. Cloud back — renewed, or a
 * project handed to a member who has it — unlocks the rooms and ends the lapse.
 *
 * The API routes do not wait for the tick: they gate on the owner's plan
 * directly (`requireProjectCloudPlan`), so a project is read-only the moment
 * the plan ends; the tick only catches the rooms and the mail up with that.
 */

import * as S3 from "@src/lib/s3";
import * as CollabUtils from "@src/lib/cloud/utils";
import * as ProjectService from "@src/server/service/project-service";
import * as UserService from "@src/server/service/user-service";
import prisma from "@src/server/db";
import {
    CloudLock,
    DAY_MS,
    deletionDateAfterFinalNotice,
    dueReminder,
    FINAL_NOTICE,
    isCloudLapseInEffect,
    isMediaDeletionDue,
    LAPSE_NOTICE,
    mediaDeletionDate,
    NoticeProjects,
    REMINDER_LEAD_DAYS,
} from "@src/lib/cloud-lapse";
import { hasActivePlan } from "@src/lib/plans";
import {
    sendCloudLapsedCollaboratorEmail,
    sendCloudLapsedOwnerEmail,
    sendCloudMediaReminderEmail,
} from "@src/lib/mail/mail";
import { logger } from "@src/lib/utils/logger";
import { CloudLapseRepository } from "../repository/cloud-lapse-repository";

const repository = new CloudLapseRepository();

type LapseRow = NonNullable<Awaited<ReturnType<CloudLapseRepository["fetchByUser"]>>>;

/** Owners handled per step and tick, so a backlog drains over a few ticks. */
const BATCH = 100;
const LOCK_KEY = "cloud-lapse-tick";

/**
 * Staging sets `CLOUD_LAPSE_DAY_SECONDS` (in docker-compose.yml) to shorten
 * the schedule's day, so a whole lapse — notice, reminders, media deletion —
 * plays out in hours, and to apply the rules regardless of the date the Terms
 * announce for production. Production never sets it.
 */
const stagingDayMs = (() => {
    const value = process.env.CLOUD_LAPSE_DAY_SECONDS;
    if (!value) return null;
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        logger.error("[CloudLapse] Ignoring an invalid CLOUD_LAPSE_DAY_SECONDS", { value });
        return null;
    }
    logger.warn("[CloudLapse] Shortened schedule", { daySeconds: seconds });
    return seconds * 1000;
})();

/** The length of a day in the schedule. */
const dayMs = stagingDayMs ?? DAY_MS;

const inEffect = (now: Date) => stagingDayMs !== null || isCloudLapseInEffect(now);

export type TickReport = {
    skipped: boolean;
    restored: number;
    lapsed: number;
    reminded: number;
    mediaDeleted: number;
};

/** One tick at a time across app instances, as the Community tick does. */
async function withAdvisoryLock<T>(run: () => Promise<T>): Promise<T | null> {
    const [{ locked }] = await prisma.$queryRaw<[{ locked: boolean }]>`
        SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY})) AS locked`;
    if (!locked) return null;
    try {
        return await run();
    } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
    }
}

export async function tick(now = new Date()): Promise<TickReport> {
    if (!inEffect(now)) return { skipped: true, restored: 0, lapsed: 0, reminded: 0, mediaDeleted: 0 };

    const report = await withAdvisoryLock(async () => {
        let restored = 0;
        for (const { userId } of await repository.listRestorable(now, BATCH)) {
            if (await attempt("restore", userId, () => restore(userId))) restored++;
        }

        await repository.deleteWithoutProjects();

        let lapsed = 0;
        for (const { id } of await repository.listOwnersToLapse(now, BATCH)) {
            const created = await repository.create(id, now, mediaDeletionDate(now, dayMs));
            if (created && (await attempt("announce", id, () => announce(id, created.mediaDeletesAt)))) lapsed++;
        }
        for (const row of await repository.listUnannounced(LAPSE_NOTICE, BATCH)) {
            if (await attempt("announce", row.userId, () => announce(row.userId, row.mediaDeletesAt))) lapsed++;
        }

        const reminded = await sendReminders(now);
        const mediaDeleted = await deleteDueMedia(now);

        return { skipped: false, restored, lapsed, reminded, mediaDeleted };
    });

    if (!report) return { skipped: true, restored: 0, lapsed: 0, reminded: 0, mediaDeleted: 0 };
    if (report.restored || report.lapsed || report.reminded || report.mediaDeleted) {
        logger.info("[CloudLapse] Tick", report);
    }
    return report;
}

/** One owner's step: a failure is logged and retried next tick, without holding up the others. */
async function attempt(step: string, userId: string, run: () => Promise<boolean>): Promise<boolean> {
    try {
        return await run();
    } catch (e) {
        logger.error(`[CloudLapse] ${step} failed`, { userId, error: e });
        return false;
    }
}

/** The owner's projects, and the projects each other member shares with them. */
async function recipients(userId: string) {
    const projects = await repository.listOwnedProjects(userId);
    const owner: NoticeProjects = { titles: [], mediaTitles: [] };
    const collaborators = new Map<string, NoticeProjects>();
    const add = (notice: NoticeProjects, title: string, hasMedia: boolean) => {
        notice.titles.push(title);
        if (hasMedia) notice.mediaTitles.push(title);
    };
    for (const project of projects) {
        const hasMedia = project._count.assets > 0;
        add(owner, project.title, hasMedia);
        for (const { user } of project.members) {
            if (!collaborators.has(user.email)) collaborators.set(user.email, { titles: [], mediaTitles: [] });
            add(collaborators.get(user.email)!, project.title, hasMedia);
        }
    }
    return { projects, owner, collaborators };
}

/**
 * Whether the owner has Cloud right now. Checked again before every step acts,
 * since a renewal can land between the query that picked the owner and the
 * step itself, and the next tick's restore then takes over.
 */
const ownerHasCloud = async (userId: string) => hasActivePlan(await UserService.getUserFromId(userId), "CLOUD");

/** Lock the owner's rooms, drop their invitations and send the lapse notices. */
async function announce(userId: string, mediaDeletesAt: Date): Promise<boolean> {
    const owner = await UserService.getUserFromId(userId);
    if (!owner || hasActivePlan(owner, "CLOUD")) return false;

    const { projects, owner: ownNotice, collaborators } = await recipients(userId);
    await repository.deleteInvitesToOwnedProjects(userId);
    // A room that misses this is locked when its next member connects (see
    // syncProjectLock), and the API already refuses its writes.
    await Promise.all(projects.map((project) => CollabUtils.setProjectRoomLocked(project.id, true)));

    void sendCloudLapsedOwnerEmail(owner.email, ownNotice, mediaDeletesAt);
    for (const [email, notice] of collaborators) {
        void sendCloudLapsedCollaboratorEmail(email, notice, mediaDeletesAt);
    }
    await repository.update(userId, { noticesSent: LAPSE_NOTICE });

    logger.info("[CloudLapse] Owner lapsed", { userId, projects: projects.length, mediaDeletesAt });
    return true;
}

async function sendReminders(now: Date): Promise<number> {
    const windows = REMINDER_LEAD_DAYS.map((leadDays, i) => ({
        notice: LAPSE_NOTICE + 1 + i,
        before: new Date(now.getTime() + leadDays * dayMs),
    }));
    let count = 0;
    for (const row of await repository.listAwaitingNotices(windows, LAPSE_NOTICE, BATCH)) {
        if (await attempt("remind", row.userId, () => remind(row, now))) count++;
    }
    return count;
}

async function remind(row: LapseRow, now: Date): Promise<boolean> {
    const due = dueReminder(row, now, dayMs);
    if (!due) return false;

    const isFinal = due.notice === FINAL_NOTICE;
    const mediaDeletesAt = isFinal
        ? deletionDateAfterFinalNotice(row.mediaDeletesAt, now, dayMs)
        : row.mediaDeletesAt;

    const owner = await UserService.getUserFromId(row.userId);
    if (!owner || hasActivePlan(owner, "CLOUD")) return false;

    // A project without media has nothing to warn about: the notice still
    // counts as sent, so the schedule moves on.
    const { owner: ownNotice, collaborators } = await recipients(row.userId);
    if (ownNotice.mediaTitles.length > 0) {
        void sendCloudMediaReminderEmail(owner.email, ownNotice.mediaTitles, mediaDeletesAt, true);
    }
    // Collaborators hear of the lapse, then once more a week before: the
    // owner is the one who can act on the 30-day reminder.
    if (isFinal) {
        for (const [email, notice] of collaborators) {
            if (notice.mediaTitles.length === 0) continue;
            void sendCloudMediaReminderEmail(email, notice.mediaTitles, mediaDeletesAt, false);
        }
    }

    await repository.update(row.userId, { noticesSent: due.notice, mediaDeletesAt });
    return true;
}

async function deleteDueMedia(now: Date): Promise<number> {
    let count = 0;
    for (const row of await repository.listMediaDeletionDue(now, FINAL_NOTICE, BATCH)) {
        if (await attempt("delete media", row.userId, () => deleteMedia(row, now))) count++;
    }
    return count;
}

async function deleteMedia(row: LapseRow, now: Date): Promise<boolean> {
    if (!isMediaDeletionDue(row, now)) return false;
    if (await ownerHasCloud(row.userId)) return false;

    const projects = await repository.listOwnedProjects(row.userId);
    let ok = true;
    for (const project of projects) {
        // The whole folder, as project teardown does: an object whose
        // tracking row was lost would otherwise stay forever.
        if (await S3.destroyPrefix(`assets/${project.id}/`)) await repository.deleteProjectAssets(project.id);
        else ok = false;
    }
    // Retried on the next tick if any folder could not be cleared.
    if (!ok) return false;

    await repository.update(row.userId, { mediaDeletedAt: now });
    logger.info("[CloudLapse] Media deleted", { userId: row.userId, projects: projects.length });
    return true;
}

/** Unlock the owner's rooms and end the lapse; kept for the next tick if a room missed it. */
async function restore(userId: string): Promise<boolean> {
    const projects = await repository.listOwnedProjects(userId);
    const unlocked = await Promise.all(projects.map((project) => CollabUtils.setProjectRoomLocked(project.id, false)));
    if (!unlocked.every(Boolean)) return false;
    await repository.delete(userId);
    logger.info("[CloudLapse] Owner restored", { userId, projects: projects.length });
    return true;
}

/**
 * Called by subscription-service whenever a plan is granted or extended, so a
 * renewal reopens the projects at once instead of on the next tick. It only
 * unlocks the rooms: ending the lapse is left to the tick, which holds the
 * tick lock, so a lapse being announced at the same moment cannot re-lock
 * the rooms after this and leave nothing behind to unlock them again.
 */
export async function restoreIfEntitled(userId: string): Promise<void> {
    try {
        if (!(await repository.fetchByUser(userId))) return;
        if (!(await ownerHasCloud(userId))) return;
        const projects = await repository.listOwnedProjects(userId);
        await Promise.all(projects.map((project) => CollabUtils.setProjectRoomLocked(project.id, false)));
    } catch (e) {
        logger.error("[CloudLapse] Restore failed", { userId, error: e });
    }
}

/** A project just moved to an owner who has Cloud: reopen it, whatever the old owner's state. */
export const unlockProject = (projectId: string) => CollabUtils.setProjectRoomLocked(projectId, false);

/**
 * A member is about to connect: bring the room's lock in line with the owner's
 * plan, both ways. This catches a room the tick has not locked yet, and heals
 * one left locked by a race (a lapse announced while the project was being
 * handed over, or while the owner renewed). Nothing to do before the rules
 * apply, as no room is locked then.
 */
export async function syncProjectLock(projectId: string): Promise<void> {
    if (!inEffect(new Date())) return;
    await CollabUtils.setProjectRoomLocked(projectId, !!(await getProjectLock(projectId)));
}

/**
 * Whether a project is read-only because its owner has no Cloud, and until
 * when its media is kept. Null when the owner has Cloud.
 */
export async function getProjectLock(projectId: string): Promise<CloudLock | null> {
    if (!inEffect(new Date())) return null;
    const ownerId = await ProjectService.getProjectOwnerId(projectId);
    if (!ownerId) return null;
    if (hasActivePlan(await UserService.getUserFromId(ownerId), "CLOUD")) return null;

    const row = await repository.fetchByUser(ownerId);
    if (row?.mediaDeletedAt || (await repository.countProjectAssets(projectId)) === 0) return { mediaDeletesAt: null };
    // Before the tick has seen the lapse, the date it will set.
    return { mediaDeletesAt: (row?.mediaDeletesAt ?? mediaDeletionDate(new Date(), dayMs)).toISOString() };
}
