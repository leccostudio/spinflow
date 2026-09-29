-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "valorCents" INTEGER NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "dataEvento" DATETIME NOT NULL,
    "dataSincronizacao" DATETIME,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "referenciaExterna" TEXT,
    "descricao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FinancialEntry_dataEvento_idx" ON "FinancialEntry"("dataEvento");

-- CreateIndex
CREATE INDEX "FinancialEntry_plataforma_idx" ON "FinancialEntry"("plataforma");

-- CreateIndex
CREATE INDEX "FinancialEntry_tipo_status_idx" ON "FinancialEntry"("tipo", "status");
