-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('CLOUD');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE', 'APPLE');

-- CreateTable
CREATE TABLE "Subscription" (
    "plan" "Plan" NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("userId","plan")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_provider_providerId_key" ON "Subscription"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every subscription that exists today is a Cloud plan sold through Stripe;
-- move it into its row before the columns go.
INSERT INTO "Subscription" ("userId", "plan", "provider", "providerId", "expiresAt", "cancelled")
SELECT "id", 'CLOUD', 'STRIPE', "stripeSubscriptionId", "cloudPlanUntil", "isSubscriptionCancelled"
FROM "User"
WHERE "stripeSubscriptionId" IS NOT NULL AND "cloudPlanUntil" IS NOT NULL;

-- DropIndex
DROP INDEX "User_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "cloudPlanUntil",
DROP COLUMN "isSubscriptionCancelled",
DROP COLUMN "stripeSubscriptionId";
