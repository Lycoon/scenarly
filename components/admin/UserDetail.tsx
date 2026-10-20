"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { UserRole, ProjectRole, Plan, SubscriptionProvider } from "../../src/generated/client/browser";
import { PLANS, PLAN_NAMES } from "@src/lib/plans";
import { grantPlan, revokeGrant } from "@src/lib/utils/requests";
import styles from "./UserDetail.module.css";

type UserDetailPayload = {
    user: {
        id: string;
        email: string;
        createdAt: string;
        emailVerified: string | null;
        username: string | null;
        role: UserRole;
        stripeCustomerId: string | null;
        stripeCustomerUrl: string | null;
    };
    subscriptions: {
        plan: Plan;
        provider: SubscriptionProvider;
        providerId: string;
        expiresAt: string;
        cancelled: boolean;
        providerUrl: string | null;
    }[];
    projectCount: number;
};

type Membership = {
    role: ProjectRole;
    project: {
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
    };
};

function formatDateTime(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function isActive(expiresAt: string | null | undefined) {
    return !!expiresAt && new Date(expiresAt) > new Date();
}

/** `YYYY-MM-DD` in local time, as a date input reads and writes it. */
function toDateInput(date: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultGrantEnd() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return toDateInput(date);
}

type GrantControlsProps = {
    userId: string;
    plan: Plan;
    sub: UserDetailPayload["subscriptions"][number] | undefined;
    onChange: () => Promise<unknown>;
};

/**
 * Give the plan away until a date, or take a grant back — how the account
 * the store reviewers sign in with gets every plan. Hidden while a store
 * bills the plan: a grant never replaces a paid subscription.
 */
function GrantControls({ userId, plan, sub, onChange }: GrantControlsProps) {
    const granted = sub?.provider === "GRANT";
    const [until, setUntil] = useState(() => (granted ? toDateInput(new Date(sub.expiresAt)) : defaultGrantEnd()));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (sub && !granted && isActive(sub.expiresAt)) return null;

    const run = async (task: () => Promise<Response>) => {
        setBusy(true);
        setError(null);
        try {
            const res = await task();
            if (res.ok) await onChange();
            else setError(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "Request failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.grantRow}>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>Granted until</span>
                <input
                    type="date"
                    className={styles.dateInput}
                    value={until}
                    min={toDateInput(new Date())}
                    onChange={(e) => setUntil(e.target.value)}
                    disabled={busy}
                />
            </label>
            <button
                className={styles.actionBtn}
                disabled={busy || !until}
                // Through the end of the chosen day.
                onClick={() => run(() => grantPlan(userId, plan, new Date(`${until}T23:59:59`)))}
            >
                {granted ? "Update grant" : `Grant ${PLAN_NAMES[plan]}`}
            </button>
            {granted && (
                <button
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    disabled={busy}
                    onClick={() => run(() => revokeGrant(userId, plan))}
                >
                    Revoke
                </button>
            )}
            {error && <span className={`${styles.message} ${styles.error}`}>{error}</span>}
        </div>
    );
}

type Props = { userId: string };

export default function UserDetail({ userId }: Props) {
    const { data, error, isLoading, mutate } = useSWR<UserDetailPayload>(
        `/api/admin/users/${userId}`,
    );
    const { data: memberships } = useSWR<Membership[]>(
        `/api/admin/users/${userId}/projects`,
    );

    return (
        <div className={styles.container}>
            <Link href="/admin/users" className={styles.backLink}>
                <ArrowLeft size={14} /> Back to search
            </Link>

            {isLoading && <p className={styles.message}>Loading user…</p>}
            {error && <p className={`${styles.message} ${styles.error}`}>User not found.</p>}

            {data && (
                <>
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>Account</h2>
                        <div className={styles.fields}>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Email</span>
                                <span className={styles.fieldValue}>{data.user.email}</span>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>User ID</span>
                                <span className={`${styles.fieldValue} ${styles.idValue}`}>
                                    {data.user.id}
                                </span>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Username</span>
                                <span className={styles.fieldValue}>
                                    {data.user.username ?? "—"}
                                </span>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Created</span>
                                <span className={styles.fieldValue}>
                                    {formatDateTime(data.user.createdAt)}
                                </span>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Email verified</span>
                                <span className={styles.fieldValue}>
                                    {data.user.emailVerified
                                        ? formatDateTime(data.user.emailVerified)
                                        : "No"}
                                </span>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Role</span>
                                <span
                                    className={`${styles.badge} ${
                                        data.user.role === UserRole.ADMIN
                                            ? styles.badgeAdmin
                                            : styles.badgeMuted
                                    }`}
                                >
                                    {data.user.role}
                                </span>
                            </div>
                        </div>
                    </section>

                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>Billing</h2>
                        <div className={styles.fields}>
                            <div className={styles.field}>
                                <span className={styles.fieldLabel}>Stripe customer</span>
                                {data.user.stripeCustomerUrl ? (
                                    <a
                                        href={data.user.stripeCustomerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`${styles.fieldValue} ${styles.idValue} ${styles.externalLink}`}
                                    >
                                        {data.user.stripeCustomerId}
                                    </a>
                                ) : (
                                    <span className={styles.fieldValue}>—</span>
                                )}
                            </div>
                        </div>
                    </section>

                    {PLANS.map((plan) => {
                        const sub = data.subscriptions.find((s) => s.plan === plan);
                        const active = isActive(sub?.expiresAt);
                        return (
                            <section key={plan} className={styles.card}>
                                <h2 className={styles.cardTitle}>{PLAN_NAMES[plan]}</h2>
                                <div className={styles.fields}>
                                    <div className={styles.field}>
                                        <span className={styles.fieldLabel}>Status</span>
                                        <span className={`${styles.badge} ${active ? styles.badgeCloud : styles.badgeMuted}`}>
                                            {active ? "Active" : sub ? "Lapsed" : "None"}
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.fieldLabel}>{active && !sub?.cancelled ? "Renews" : "Expires"}</span>
                                        <span className={styles.fieldValue}>{formatDateTime(sub?.expiresAt ?? null)}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.fieldLabel}>Cancelled</span>
                                        <span className={`${styles.badge} ${sub?.cancelled ? styles.badgeDanger : styles.badgeMuted}`}>
                                            {sub?.cancelled ? "Yes" : "No"}
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.fieldLabel}>Billed by</span>
                                        <span className={styles.fieldValue}>{sub?.provider ?? "—"}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.fieldLabel}>
                                            {sub?.provider === "APPLE"
                                                ? "Apple transaction"
                                                : sub?.provider === "GRANT"
                                                  ? "Grant"
                                                  : "Stripe subscription"}
                                        </span>
                                        {sub?.providerUrl ? (
                                            <a
                                                href={sub.providerUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`${styles.fieldValue} ${styles.idValue} ${styles.externalLink}`}
                                            >
                                                {sub.providerId}
                                            </a>
                                        ) : (
                                            <span className={`${styles.fieldValue} ${styles.idValue}`}>{sub?.providerId ?? "—"}</span>
                                        )}
                                    </div>
                                </div>
                                <GrantControls
                                    // Remount after a change so the date picks up the saved end.
                                    key={`${sub?.provider}:${sub?.expiresAt}`}
                                    userId={userId}
                                    plan={plan}
                                    sub={sub}
                                    onChange={mutate}
                                />
                            </section>
                        );
                    })}

                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>
                            Projects ({data.projectCount})
                        </h2>
                        <div className={styles.table}>
                            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
                                <span>Title</span>
                                <span>Role</span>
                                <span>Updated</span>
                            </div>
                            {!memberships && (
                                <div className={styles.emptyRow}>Loading…</div>
                            )}
                            {memberships && memberships.length === 0 && (
                                <div className={styles.emptyRow}>
                                    This user has no projects.
                                </div>
                            )}
                            {memberships?.map((m) => (
                                <Link
                                    key={m.project.id}
                                    href={`/admin/projects/${m.project.id}`}
                                    className={`${styles.tableRow} ${styles.tableRowLink}`}
                                >
                                    <span>{m.project.title}</span>
                                    <span className={styles.tableCellMuted}>{m.role}</span>
                                    <span className={styles.tableCellMuted}>
                                        {formatDateTime(m.project.updatedAt)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
