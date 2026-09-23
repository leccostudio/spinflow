-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "backupAccountId" TEXT,
    CONSTRAINT "WhatsAppGroup_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppGroup_backupAccountId_fkey" FOREIGN KEY ("backupAccountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppGroup" ("accountId", "id", "isAutomationGroup", "isMonitoring", "isSending", "jid", "lastSyncedAt", "monitoredMarketplaces", "name", "participantsCount", "useOriginalImage") SELECT "accountId", "id", "isAutomationGroup", "isMonitoring", "isSending", "jid", "lastSyncedAt", "monitoredMarketplaces", "name", "participantsCount", "useOriginalImage" FROM "WhatsAppGroup";
DROP TABLE "WhatsAppGroup";
ALTER TABLE "new_WhatsAppGroup" RENAME TO "WhatsAppGroup";
CREATE UNIQUE INDEX "WhatsAppGroup_jid_key" ON "WhatsAppGroup"("jid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
