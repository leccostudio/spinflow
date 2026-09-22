-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupIds" TEXT NOT NULL,
    "text" TEXT,
    "productId" TEXT,
    "templateId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AutoDispatchSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "endHour" INTEGER NOT NULL DEFAULT 22,
    "minIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "minProductsPerRun" INTEGER NOT NULL DEFAULT 1,
    "maxProductsPerRun" INTEGER NOT NULL DEFAULT 2,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CapturedProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceUrl" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CAPTURED',
    "conversionError" TEXT,
    "messageText" TEXT,
    "imagePath" TEXT,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "dispatchedAt" DATETIME,
    "sourceGroupId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapturedProduct_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "WhatsAppGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CapturedProduct" ("affiliateUrl", "capturedAt", "conversionError", "dedupeKey", "id", "imagePath", "marketplace", "messageText", "sourceGroupId", "sourceUrl", "status") SELECT "affiliateUrl", "capturedAt", "conversionError", "dedupeKey", "id", "imagePath", "marketplace", "messageText", "sourceGroupId", "sourceUrl", "status" FROM "CapturedProduct";
DROP TABLE "CapturedProduct";
ALTER TABLE "new_CapturedProduct" RENAME TO "CapturedProduct";
CREATE INDEX "CapturedProduct_dedupeKey_idx" ON "CapturedProduct"("dedupeKey");
CREATE INDEX "CapturedProduct_capturedAt_idx" ON "CapturedProduct"("capturedAt");
CREATE TABLE "new_WhatsAppGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "isSending" BOOLEAN NOT NULL DEFAULT false,
    "monitoredMarketplaces" TEXT NOT NULL DEFAULT '',
    "useOriginalImage" BOOLEAN NOT NULL DEFAULT true,
    "isAutomationGroup" BOOLEAN NOT NULL DEFAULT false,
    "participantsCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "WhatsAppGroup_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppGroup" ("accountId", "id", "isMonitoring", "isSending", "jid", "lastSyncedAt", "monitoredMarketplaces", "name", "participantsCount", "useOriginalImage") SELECT "accountId", "id", "isMonitoring", "isSending", "jid", "lastSyncedAt", "monitoredMarketplaces", "name", "participantsCount", "useOriginalImage" FROM "WhatsAppGroup";
DROP TABLE "WhatsAppGroup";
ALTER TABLE "new_WhatsAppGroup" RENAME TO "WhatsAppGroup";
CREATE UNIQUE INDEX "WhatsAppGroup_jid_key" ON "WhatsAppGroup"("jid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ScheduledMessage_status_scheduledAt_idx" ON "ScheduledMessage"("status", "scheduledAt");
