-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plataforma" TEXT NOT NULL,
    "tipoAutenticacao" TEXT NOT NULL DEFAULT 'token',
    "credenciaisEnc" TEXT NOT NULL DEFAULT '',
    "segmentoId" TEXT,
    "statusConexao" TEXT NOT NULL DEFAULT 'desconectado',
    "statusMensagem" TEXT,
    "ultimaSincronizacao" DATETIME,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_plataforma_key" ON "IntegrationCredential"("plataforma");
