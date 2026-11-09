-- Owners whose Cloud plan ended while they still own cloud projects: their
-- projects go read-only and their media is deleted after a notice period.
CREATE TABLE "CloudLapse" (
    "lapsedAt" TIMESTAMP(3) NOT NULL,
    "mediaDeletesAt" TIMESTAMP(3) NOT NULL,
    "noticesSent" INTEGER NOT NULL DEFAULT 0,
    "mediaDeletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "CloudLapse_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "CloudLapse_mediaDeletesAt_idx" ON "CloudLapse"("mediaDeletesAt");

ALTER TABLE "CloudLapse" ADD CONSTRAINT "CloudLapse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
