-- CreateEnum
CREATE TYPE "ChangeLevel" AS ENUM ('NONE', 'MINOR', 'MODERATE', 'MAJOR');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "confirmationsRequired" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "SiteUptimeState" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SiteSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "htmlSize" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "headers" JSONB NOT NULL,
    "previousSnapshotId" TEXT,
    "diffSummary" JSONB,
    "changeLevel" "ChangeLevel" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteSnapshot_siteId_createdAt_idx" ON "SiteSnapshot"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteSnapshot_createdAt_idx" ON "SiteSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "SiteSnapshot" ADD CONSTRAINT "SiteSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSnapshot" ADD CONSTRAINT "SiteSnapshot_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "SiteSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
