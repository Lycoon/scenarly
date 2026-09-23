"use client";

import { useContext, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowBigUp } from "lucide-react";

import { DashboardContext } from "@src/context/DashboardContext";
import { useCommunityMe } from "@src/lib/community/hooks";
import { join } from "@src/lib/utils/misc";

import styles from "./UpvoteButton.module.css";

interface UpvoteButtonProps {
    count: number;
    upvoted: boolean;
    onToggle: (on: boolean) => Promise<void>;
    size?: "small" | "large";
}

/**
 * Upvote toggle with its count. Signed out, it opens the sign-in drawer; a
 * signed-in user who does not pass the Community entry gate yet sees why it is
 * off. Membership comes from `/community/me`, which also creates the profile
 * of an eligible user, so by the time they click they can vote.
 */
const UpvoteButton = ({ count, upvoted, onToggle, size = "small" }: UpvoteButtonProps) => {
    const t = useTranslations("community.showcase");
    const { me, user, isLoading } = useCommunityMe();
    const { openDashboard } = useContext(DashboardContext);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    const ineligible = !!user && !!me && !me.profile;
    const title = failed ? t("upvoteFailed") : !user && !isLoading ? t("upvoteSignIn") : ineligible ? t("upvoteNotEligible") : t("upvote");

    const onClick = async () => {
        if (!user) return openDashboard("Auth");
        setBusy(true);
        setFailed(false);
        try {
            await onToggle(!upvoted);
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            className={join(styles.button, upvoted ? styles.on : "", size === "large" ? styles.large : "")}
            onClick={onClick}
            disabled={busy || isLoading || ineligible}
            aria-pressed={upvoted}
            aria-label={`${t("upvote")} (${count})`}
            title={title}
        >
            <ArrowBigUp size={size === "large" ? 20 : 16} fill={upvoted ? "currentColor" : "none"} />
            {count}
        </button>
    );
};

export default UpvoteButton;
