-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "shopeeAppId" TEXT NOT NULL DEFAULT '',
    "shopeeAppSecret" TEXT NOT NULL DEFAULT '',
    "shopeeSubIds" TEXT NOT NULL DEFAULT '',
    "amazonAffiliateTag" TEXT NOT NULL DEFAULT '',
    "mercadoLivreTag" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonitoringSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "restrictedWords" TEXT NOT NULL DEFAULT '',
    "allowedWords" TEXT NOT NULL DEFAULT '',
    "dedupeWindowHours" INTEGER NOT NULL DEFAULT 12,
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
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "nameOverride" TEXT,
    "priceOriginalOverride" TEXT,
    "priceDiscountedOverride" TEXT,
    "couponOverride" TEXT,
    "sourceGroupId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapturedProduct_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "WhatsAppGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CapturedProduct" ("affiliateUrl", "capturedAt", "conversionError", "dedupeKey", "dispatchedAt", "id", "imagePath", "marketplace", "messageText", "priority", "sourceGroupId", "sourceUrl", "status") SELECT "affiliateUrl", "capturedAt", "conversionError", "dedupeKey", "dispatchedAt", "id", "imagePath", "marketplace", "messageText", "priority", "sourceGroupId", "sourceUrl", "status" FROM "CapturedProduct";
DROP TABLE "CapturedProduct";
ALTER TABLE "new_CapturedProduct" RENAME TO "CapturedProduct";
CREATE INDEX "CapturedProduct_dedupeKey_idx" ON "CapturedProduct"("dedupeKey");
CREATE INDEX "CapturedProduct_capturedAt_idx" ON "CapturedProduct"("capturedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
