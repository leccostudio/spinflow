-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlatformSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "shopeeAppId" TEXT NOT NULL DEFAULT '',
    "shopeeAppSecret" TEXT NOT NULL DEFAULT '',
    "shopeeSubIds" TEXT NOT NULL DEFAULT '',
    "amazonAffiliateTag" TEXT NOT NULL DEFAULT '',
    "mercadoLivreTag" TEXT NOT NULL DEFAULT '',
    "mercadoLivreCode" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlatformSettings" ("amazonAffiliateTag", "id", "mercadoLivreTag", "shopeeAppId", "shopeeAppSecret", "shopeeSubIds", "updatedAt") SELECT "amazonAffiliateTag", "id", "mercadoLivreTag", "shopeeAppId", "shopeeAppSecret", "shopeeSubIds", "updatedAt" FROM "PlatformSettings";
DROP TABLE "PlatformSettings";
ALTER TABLE "new_PlatformSettings" RENAME TO "PlatformSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
