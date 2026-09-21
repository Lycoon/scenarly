-- CreateEnum
CREATE TYPE "CommunityFormat" AS ENUM ('FEATURE', 'SHORT', 'PILOT', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityGenre" AS ENUM ('ACTION', 'ADVENTURE', 'ANIMATION', 'COMEDY', 'CRIME', 'DRAMA', 'FAMILY', 'FANTASY', 'HORROR', 'MYSTERY', 'ROMANCE', 'SCIFI', 'THRILLER', 'WESTERN', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunitySubmissionStatus" AS ENUM ('POOLED', 'RETIRED', 'SHOWCASE_ONLY', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommunityCreditReason" AS ENUM ('STARTER', 'SUBMISSION', 'REVIEW_COMPLETED', 'SUBMISSION_REFUND', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "CommunityClaimStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED', 'RELEASED');

-- CreateEnum
CREATE TYPE "CommunityReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "CommunityRating" AS ENUM ('USEFUL', 'NOT_USEFUL');

-- CreateEnum
CREATE TYPE "CommunityShowcaseKind" AS ENUM ('FULL_SCRIPT', 'PILOT', 'SHORT', 'LOGLINE');

-- CreateEnum
CREATE TYPE "CommunityReportReason" AS ENUM ('ABUSIVE', 'OFF_TOPIC', 'LOW_EFFORT', 'AI_GENERATED', 'OTHER');

-- CreateTable
CREATE TABLE "CommunityProfile" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "penName" TEXT NOT NULL,
    "activeClaimId" TEXT,
    "usefulCount" INTEGER NOT NULL DEFAULT 0,
    "notUsefulCount" INTEGER NOT NULL DEFAULT 0,
    "reviewsCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastReshuffleAt" TIMESTAMP(3),

    CONSTRAINT "CommunityProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CommunityCreditEntry" (
    "id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CommunityCreditReason" NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CommunityCreditEntry_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "CommunityProfile_activeClaimId_key" ON "CommunityProfile"("activeClaimId");

-- CreateIndex
CREATE INDEX "CommunityCreditEntry_userId_createdAt_idx" ON "CommunityCreditEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityCreditEntry_userId_reason_refId_key" ON "CommunityCreditEntry"("userId", "reason", "refId");

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
ALTER TABLE "CommunityProfile" ADD CONSTRAINT "CommunityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityCreditEntry" ADD CONSTRAINT "CommunityCreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CommunityProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

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

