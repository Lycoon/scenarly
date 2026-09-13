-- The paid subscription was renamed from "Pro" to "Cloud".
ALTER TABLE "User" RENAME COLUMN "isProUntil" TO "cloudPlanUntil";
