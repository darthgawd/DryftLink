-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Site" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SiteCheck" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteCheck_userId_siteId_checkedAt_idx" ON "SiteCheck"("userId", "siteId", "checkedAt");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteCheck" ADD CONSTRAINT "SiteCheck_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteCheck" ADD CONSTRAINT "SiteCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "Site_url_key";

-- CreateIndex
CREATE UNIQUE INDEX "Site_userId_url_key" ON "Site"("userId", "url");
