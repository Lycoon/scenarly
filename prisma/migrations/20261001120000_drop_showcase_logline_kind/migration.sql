-- Showcase no longer shows a logline on its own: an entry always shows its
-- script. A logline-only entry was published with its PDF kept private, so it
-- is taken off the wall rather than turned into a full-script entry; its
-- upvotes go with it (ON DELETE CASCADE). The submission itself stays, and its
-- author can publish it again, script included.
--
-- Postgres cannot drop an enum value, so the type is swapped for one without it.
BEGIN;
DELETE FROM "CommunityShowcaseEntry" WHERE "kind" = 'LOGLINE';
CREATE TYPE "CommunityShowcaseKind_new" AS ENUM ('FULL_SCRIPT', 'PILOT', 'SHORT');
ALTER TABLE "CommunityShowcaseEntry" ALTER COLUMN "kind" TYPE "CommunityShowcaseKind_new" USING ("kind"::text::"CommunityShowcaseKind_new");
ALTER TYPE "CommunityShowcaseKind" RENAME TO "CommunityShowcaseKind_old";
ALTER TYPE "CommunityShowcaseKind_new" RENAME TO "CommunityShowcaseKind";
DROP TYPE "CommunityShowcaseKind_old";
COMMIT;
