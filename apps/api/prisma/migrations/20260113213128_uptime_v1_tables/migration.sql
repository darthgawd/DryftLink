-- CreateEnum
CREATE TYPE "SiteCheckStatus" AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "UptimeState" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteCheck" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "SiteCheckStatus" NOT NULL,
    "httpStatus" INTEGER,
    "finalUrl" TEXT,
    "durationMs" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteUptimeState" (
    "siteId" TEXT NOT NULL,
    "state" "UptimeState" NOT NULL,
    "lastStatus" "SiteCheckStatus" NOT NULL,
    "lastHttpStatus" INTEGER,
    "lastFinalUrl" TEXT,
    "lastDurationMs" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteUptimeState_pkey" PRIMARY KEY ("siteId")
);

-- CreateTable
CREATE TABLE "UptimeEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fromState" "UptimeState" NOT NULL,
    "toState" "UptimeState" NOT NULL,
    "reasonStatus" "SiteCheckStatus" NOT NULL,
    "reasonHttpStatus" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UptimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Site_userId_idx" ON "Site"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_userId_url_key" ON "Site"("userId", "url");

-- CreateIndex
CREATE INDEX "SiteCheck_siteId_checkedAt_idx" ON "SiteCheck"("siteId", "checkedAt");

-- CreateIndex
CREATE INDEX "SiteCheck_checkedAt_idx" ON "SiteCheck"("checkedAt");

-- CreateIndex
CREATE INDEX "UptimeEvent_siteId_createdAt_idx" ON "UptimeEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "UptimeEvent_createdAt_idx" ON "UptimeEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteCheck" ADD CONSTRAINT "SiteCheck_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteUptimeState" ADD CONSTRAINT "SiteUptimeState_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UptimeEvent" ADD CONSTRAINT "UptimeEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
