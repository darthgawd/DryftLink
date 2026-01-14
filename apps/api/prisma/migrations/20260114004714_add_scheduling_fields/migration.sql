-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "checkInterval" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "isMonitoringEnabled" BOOLEAN NOT NULL DEFAULT true;
