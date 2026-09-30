import { prisma } from "../db/client.js";
import { encryptSecret, decryptSecret } from "../crypto/secretBox.js";
import { testShopeeConnection, fetchShopeeReport } from "./shopee.js";

const PLATAFORMA = "shopee";
const CHECK_INTERVAL_MS = 60_000;
const MIN_SYNC_INTERVAL_MINUTES = 15;
const MAX_LOOKBACK_DAYS = 90;

interface ShopeeCreds {
  appId?: string;
  appSecret?: string;
}

function readCreds(enc: string): ShopeeCreds {
  if (!enc) return {};
  try {
    return JSON.parse(decryptSecret(enc)) as ShopeeCreds;
  } catch {
    return {};
  }
}

// Mapeia o status cru da Shopee pro nosso vocabulario.
function mapStatus(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("cancel") || s.includes("refund")) return "cancelado";
  if (
    s.includes("complete") ||
    s.includes("approved") ||
    s.includes("validated") ||
    s.includes("paid") ||
    s.includes("fulfilled")
  )
    return "aprovado";
  return "pendente";
}

export async function getShopeeCredential() {
  return prisma.integrationCredential.findUnique({ where: { plataforma: PLATAFORMA } });
}

// Objeto seguro pra API/UI - nunca devolve o app secret.
export async function getShopeeStatus() {
  const row = await getShopeeCredential();
  if (!row) {
    return {
      connected: false,
      statusConexao: "desconectado",
      statusMensagem: null as string | null,
      appId: "",
      hasSecret: false,
      ultimaSincronizacao: null as Date | null,
      syncEnabled: false,
      syncIntervalMinutes: 360,
      lookbackDays: 7,
    };
  }
  const creds = readCreds(row.credenciaisEnc);
  return {
    connected: row.statusConexao === "conectado",
    statusConexao: row.statusConexao,
    statusMensagem: row.statusMensagem,
    appId: creds.appId ?? "",
    hasSecret: Boolean(creds.appSecret),
    ultimaSincronizacao: row.ultimaSincronizacao,
    syncEnabled: row.syncEnabled,
    syncIntervalMinutes: row.syncIntervalMinutes,
    lookbackDays: row.lookbackDays,
  };
}

export interface ConnectShopeeInput {
  appId?: string;
  appSecret?: string; // se vazio numa atualizacao, mantem o atual
  syncEnabled?: boolean;
  syncIntervalMinutes?: number;
  lookbackDays?: number;
}

export async function connectShopee(input: ConnectShopeeInput) {
  const existing = await getShopeeCredential();
  const existingCreds = existing ? readCreds(existing.credenciaisEnc) : {};

  const appId = input.appId !== undefined ? input.appId.trim() : existingCreds.appId ?? "";
  const appSecret =
    input.appSecret && input.appSecret.trim() ? input.appSecret.trim() : existingCreds.appSecret ?? "";

  if (!appId) throw new Error("Informe o App ID da Shopee.");
  if (!appSecret) throw new Error("Informe o App Secret da Shopee.");

  const syncIntervalMinutes =
    input.syncIntervalMinutes !== undefined
      ? Math.max(MIN_SYNC_INTERVAL_MINUTES, Math.floor(input.syncIntervalMinutes))
      : existing?.syncIntervalMinutes ?? 360;
  const lookbackDays =
    input.lookbackDays !== undefined
      ? Math.min(MAX_LOOKBACK_DAYS, Math.max(1, Math.floor(input.lookbackDays)))
      : existing?.lookbackDays ?? 7;
  const syncEnabled = input.syncEnabled !== undefined ? input.syncEnabled : existing?.syncEnabled ?? false;

  let statusConexao = "erro";
  let statusMensagem: string | null = null;
  try {
    await testShopeeConnection(appId, appSecret);
    statusConexao = "conectado";
    statusMensagem = "Conexão com a Shopee OK.";
  } catch (err) {
    statusConexao = "erro";
    statusMensagem = err instanceof Error ? err.message : "Falha ao conectar na Shopee.";
  }

  const credenciaisEnc = encryptSecret(JSON.stringify({ appId, appSecret }));
  const data = {
    tipoAutenticacao: "app_secret",
    credenciaisEnc,
    statusConexao,
    statusMensagem,
    syncEnabled,
    syncIntervalMinutes,
    lookbackDays,
  };

  if (existing) {
    await prisma.integrationCredential.update({ where: { plataforma: PLATAFORMA }, data });
  } else {
    await prisma.integrationCredential.create({ data: { plataforma: PLATAFORMA, ...data } });
  }
  return getShopeeStatus();
}

export async function testShopee() {
  const row = await getShopeeCredential();
  if (!row) throw new Error("Shopee não configurada.");
  const creds = readCreds(row.credenciaisEnc);
  if (!creds.appId || !creds.appSecret) throw new Error("Credenciais incompletas.");
  try {
    await testShopeeConnection(creds.appId, creds.appSecret);
    await prisma.integrationCredential.update({
      where: { plataforma: PLATAFORMA },
      data: { statusConexao: "conectado", statusMensagem: "Conexão com a Shopee OK." },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao conectar na Shopee.";
    await prisma.integrationCredential.update({
      where: { plataforma: PLATAFORMA },
      data: { statusConexao: "erro", statusMensagem: msg },
    });
    throw new Error(msg);
  }
  return getShopeeStatus();
}

export async function disconnectShopee() {
  await prisma.integrationCredential.deleteMany({ where: { plataforma: PLATAFORMA } });
  return { ok: true };
}

/**
 * Puxa o Conversion Report (grava/atualiza cada pedido como ganho com o status
 * atual) e o Validated Report (marca como aprovado os pedidos ja validados).
 * Dedupe por referenciaExterna = "shopee:{orderId}".
 */
export async function runShopeeSync(): Promise<{
  imported: number;
  updated: number;
  validated: number;
  total: number;
}> {
  const row = await getShopeeCredential();
  if (!row) throw new Error("Shopee não configurada.");
  const creds = readCreds(row.credenciaisEnc);
  if (!creds.appId || !creds.appSecret) throw new Error("Credenciais incompletas.");

  const until = Math.floor(Date.now() / 1000);
  const since = until - row.lookbackDays * 24 * 3600;

  let conversions;
  let validated;
  try {
    conversions = await fetchShopeeReport(creds.appId, creds.appSecret, "conversion", since, until);
    validated = await fetchShopeeReport(creds.appId, creds.appSecret, "validated", since, until);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao sincronizar com a Shopee.";
    await prisma.integrationCredential.update({
      where: { plataforma: PLATAFORMA },
      data: { statusConexao: "erro", statusMensagem: msg },
    });
    throw new Error(msg);
  }

  let imported = 0;
  let updated = 0;
  for (const o of conversions) {
    const referenciaExterna = `shopee:${o.orderId}`;
    const valorCents = Math.round(o.commission * 100);
    const status = mapStatus(o.status);
    const existing = await prisma.financialEntry.findFirst({
      where: { plataforma: PLATAFORMA, referenciaExterna },
    });
    if (existing) {
      await prisma.financialEntry.update({
        where: { id: existing.id },
        data: { valorCents, status, dataSincronizacao: new Date() },
      });
      updated++;
    } else {
      await prisma.financialEntry.create({
        data: {
          tipo: "ganho",
          plataforma: PLATAFORMA,
          valorCents,
          moeda: "BRL",
          status,
          dataEvento: new Date(o.purchaseTime * 1000),
          dataSincronizacao: new Date(),
          origem: "api",
          referenciaExterna,
          descricao: `Pedido Shopee ${o.orderId}`,
        },
      });
      imported++;
    }
  }

  // Validated Report: marca como aprovado os pedidos ja validados.
  let validatedCount = 0;
  for (const o of validated) {
    const referenciaExterna = `shopee:${o.orderId}`;
    const valorCents = Math.round(o.commission * 100);
    const existing = await prisma.financialEntry.findFirst({
      where: { plataforma: PLATAFORMA, referenciaExterna },
    });
    if (existing) {
      await prisma.financialEntry.update({
        where: { id: existing.id },
        data: {
          status: "aprovado",
          valorCents: valorCents || existing.valorCents,
          dataSincronizacao: new Date(),
        },
      });
    } else {
      await prisma.financialEntry.create({
        data: {
          tipo: "ganho",
          plataforma: PLATAFORMA,
          valorCents,
          moeda: "BRL",
          status: "aprovado",
          dataEvento: new Date(o.purchaseTime * 1000),
          dataSincronizacao: new Date(),
          origem: "api",
          referenciaExterna,
          descricao: `Pedido Shopee ${o.orderId}`,
        },
      });
      imported++;
    }
    validatedCount++;
  }

  await prisma.integrationCredential.update({
    where: { plataforma: PLATAFORMA },
    data: {
      statusConexao: "conectado",
      statusMensagem: `Última sync: ${imported} novo(s), ${updated} atualizado(s), ${validatedCount} validado(s).`,
      ultimaSincronizacao: new Date(),
    },
  });

  return { imported, updated, validated: validatedCount, total: conversions.length + validated.length };
}

let syncing = false;

async function maybeRunScheduledSync(): Promise<void> {
  const row = await getShopeeCredential();
  if (!row || !row.syncEnabled) return;
  if (syncing) return;

  const now = Date.now();
  const last = row.ultimaSincronizacao ? row.ultimaSincronizacao.getTime() : 0;
  const dueAt = last + row.syncIntervalMinutes * 60_000;
  if (last && now < dueAt) return;

  syncing = true;
  try {
    const r = await runShopeeSync();
    console.log(`[shopee-sync] ${r.imported} novo(s), ${r.updated} atualizado(s), ${r.validated} validado(s).`);
  } catch (err) {
    console.error("[shopee-sync] Erro na sincronização:", err instanceof Error ? err.message : err);
  } finally {
    syncing = false;
  }
}

export function startShopeeSyncLoop(): NodeJS.Timeout {
  return setInterval(() => {
    maybeRunScheduledSync().catch((err) => console.error("[shopee-sync] Erro no loop:", err));
  }, CHECK_INTERVAL_MS);
}
