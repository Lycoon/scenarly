-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('CLOUD');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE', 'APPLE', 'GRANT');

-- CreateEnum
CREATE TYPE "CommunityFormat" AS ENUM ('FEATURE', 'SHORT', 'PILOT', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityGenre" AS ENUM ('ACTION', 'ADVENTURE', 'ANIMATION', 'COMEDY', 'CRIME', 'DRAMA', 'FAMILY', 'FANTASY', 'HORROR', 'MYSTERY', 'ROMANCE', 'SCIFI', 'THRILLER', 'WESTERN', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunitySubmissionStatus" AS ENUM ('POOLED', 'RETIRED', 'SHOWCASE_ONLY', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommunityTicketReason" AS ENUM ('STARTER', 'SUBMISSION', 'REVIEW_COMPLETED', 'SUBMISSION_REFUND', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "CommunityClaimStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED', 'RELEASED');

-- CreateEnum
CREATE TYPE "CommunityReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "CommunityRating" AS ENUM ('USEFUL', 'NOT_USEFUL');

-- CreateEnum
CREATE TYPE "CommunityShowcaseKind" AS ENUM ('FULL_SCRIPT', 'PILOT', 'SHORT');

-- CreateEnum
CREATE TYPE "CommunityReportReason" AS ENUM ('ABUSIVE', 'OFF_TOPIC', 'LOW_EFFORT', 'AI_GENERATED', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "username" TEXT,
    "color" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "stripeCustomerId" TEXT,
    "settings" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "SignInCode" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "inviteToken" TEXT,

    CONSTRAINT "SignInCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "author" TEXT,
    "hasPoster" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" SERIAL NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInvitation" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityProfile" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeClaimId" TEXT,
    "usefulCount" INTEGER NOT NULL DEFAULT 0,
    "notUsefulCount" INTEGER NOT NULL DEFAULT 0,
    "reviewsCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastReshuffleAt" TIMESTAMP(3),

    CONSTRAINT "CommunityProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CommunityTicketEntry" (
    "id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CommunityTicketReason" NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CommunityTicketEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySubmission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "CommunitySubmissionStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "logline" TEXT NOT NULL,
    "genres" "CommunityGenre"[],
    "format" "CommunityFormat" NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "sourceProjectId" TEXT,
    "poolExitAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "fileDeletedAt" TIMESTAMP(3),
    "completedReviewCount" INTEGER NOT NULL DEFAULT 0,
    "offerCount" INTEGER NOT NULL DEFAULT 0,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "CommunitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityOfferSet" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "reviewerId" TEXT NOT NULL,

    CONSTRAINT "CommunityOfferSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityOfferItem" (
    "offerSetId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CommunityOfferItem_pkey" PRIMARY KEY ("offerSetId","submissionId")
);

-- CreateTable
CREATE TABLE "CommunityClaim" (
    "id" TEXT NOT NULL,
    "status" "CommunityClaimStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "floorAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "watermarkKey" TEXT,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT,

    CONSTRAINT "CommunityClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReview" (
    "claimId" TEXT NOT NULL,
    "status" "CommunityReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "worksWell" TEXT NOT NULL DEFAULT '',
    "doesNotWork" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "rating" "CommunityRating",
    "ratedAt" TIMESTAMP(3),

    CONSTRAINT "CommunityReview_pkey" PRIMARY KEY ("claimId")
);

-- CreateTable
CREATE TABLE "CommunityReviewReport" (
    "id" TEXT NOT NULL,
    "reason" "CommunityReportReason" NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewClaimId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,

    CONSTRAINT "CommunityReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityShowcaseEntry" (
    "submissionId" TEXT NOT NULL,
    "kind" "CommunityShowcaseKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unpublishedAt" TIMESTAMP(3),
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommunityShowcaseEntry_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "CommunityUpvote" (
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityUpvote_pkey" PRIMARY KEY ("submissionId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_provider_providerId_key" ON "Subscription"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "SignInCode_email_createdAt_idx" ON "SignInCode"("email", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAsset_projectId_idx" ON "ProjectAsset"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAsset_projectId_hash_key" ON "ProjectAsset"("projectId", "hash");

-- CreateIndex
CREATE INDEX "DataExport_userId_idx" ON "DataExport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_userId_projectId_key" ON "ProjectMember"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvitation_token_key" ON "ProjectInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvitation_email_projectId_key" ON "ProjectInvitation"("email", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfile_activeClaimId_key" ON "CommunityProfile"("activeClaimId");

-- CreateIndex
CREATE INDEX "CommunityTicketEntry_userId_createdAt_idx" ON "CommunityTicketEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTicketEntry_userId_reason_refId_key" ON "CommunityTicketEntry"("userId", "reason", "refId");

-- CreateIndex
CREATE INDEX "CommunitySubmission_sha256_idx" ON "CommunitySubmission"("sha256");

-- CreateIndex
CREATE INDEX "CommunitySubmission_status_poolExitAt_idx" ON "CommunitySubmission"("status", "poolExitAt");

-- CreateIndex
CREATE INDEX "CommunitySubmission_authorId_createdAt_idx" ON "CommunitySubmission"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityOfferSet_reviewerId_createdAt_idx" ON "CommunityOfferSet"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityOfferItem_submissionId_idx" ON "CommunityOfferItem"("submissionId");

-- CreateIndex
CREATE INDEX "CommunityClaim_reviewerId_status_idx" ON "CommunityClaim"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "CommunityClaim_status_floorAt_idx" ON "CommunityClaim"("status", "floorAt");

-- CreateIndex
CREATE INDEX "CommunityClaim_status_deadlineAt_idx" ON "CommunityClaim"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityClaim_submissionId_reviewerId_key" ON "CommunityClaim"("submissionId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReviewReport_reviewClaimId_reporterId_key" ON "CommunityReviewReport"("reviewClaimId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityShowcaseEntry_slug_key" ON "CommunityShowcaseEntry"("slug");

-- CreateIndex
CREATE INDEX "CommunityShowcaseEntry_kind_publishedAt_idx" ON "CommunityShowcaseEntry"("kind", "publishedAt");

-- CreateIndex
CREATE INDEX "CommunityShowcaseEntry_unpublishedAt_upvoteCount_idx" ON "CommunityShowcaseEntry"("unpublishedAt", "upvoteCount");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityProfile" ADD CONSTRAINT "CommunityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityTicketEntry" ADD CONSTRAINT "CommunityTicketEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CommunityProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunitySubmission" ADD CONSTRAINT "CommunitySubmission_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunitySubmission" ADD CONSTRAINT "CommunitySubmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "CommunityProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityOfferSet" ADD CONSTRAINT "CommunityOfferSet_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "CommunityProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityOfferItem" ADD CONSTRAINT "CommunityOfferItem_offerSetId_fkey" FOREIGN KEY ("offerSetId") REFERENCES "CommunityOfferSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityOfferItem" ADD CONSTRAINT "CommunityOfferItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CommunitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityClaim" ADD CONSTRAINT "CommunityClaim_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CommunitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityClaim" ADD CONSTRAINT "CommunityClaim_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "CommunityProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "CommunityClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReviewReport" ADD CONSTRAINT "CommunityReviewReport_reviewClaimId_fkey" FOREIGN KEY ("reviewClaimId") REFERENCES "CommunityReview"("claimId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReviewReport" ADD CONSTRAINT "CommunityReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "CommunityProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityShowcaseEntry" ADD CONSTRAINT "CommunityShowcaseEntry_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CommunitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityUpvote" ADD CONSTRAINT "CommunityUpvote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CommunityShowcaseEntry"("submissionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityUpvote" ADD CONSTRAINT "CommunityUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CommunityProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

