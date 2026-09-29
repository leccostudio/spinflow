import { prisma } from "../db/client.js";
import { encryptSecret, decryptSecret } from "../crypto/secretBox.js";
import { testMetaConnection, fetchCampaignSpend } from "./meta.js";

const PLATAFORMA = "meta";
const CHECK_INTERVAL_MS = 60_000;
const MIN_SYNC_INTERVAL_MINUTES = 15; // evita martelar a API da Meta
const MAX_LOOKBACK_DAYS = 90;

interface MetaCreds {
  appId?: string;
  accessToken?: string;
  currency?: string;
}

function readCreds(enc: string): MetaCreds {
  if (!enc) return {};
  try {
    return JSON.parse(decryptSecret(enc)) as MetaCreds;
  } catch {
    return {};
  }
}

export async function getMetaCredential() {
  return prisma.integrationCredential.findUnique({ where: { plataforma: PLATAFORMA } });
}

// Objeto seguro pra API/UI - NUNCA devolve o access token.
export async function getMetaStatus() {
  const row = await getMetaCredential();
  if (!row) {
    return {
      connected: false,
      statusConexao: "desconectado",
      statusMensagem: null as string | null,
      segmentoId: null as string | null,
      appId: "",
      hasToken: false,
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
    segmentoId: row.segmentoId,
    appId: creds.appId ?? "",
    hasToken: Boolean(creds.accessToken),
    ultimaSincronizacao: row.ultimaSincronizacao,
    syncEnabled: row.syncEnabled,
    syncIntervalMinutes: row.syncIntervalMinutes,
    lookbackDays: row.lookbackDays,
  };
}

export interface ConnectMetaInput {
  appId?: string;
  accessToken?: string; // se vazio numa atualizacao, mantem o token atual
  adAccountId?: string;
  syncEnabled?: boolean;
  syncIntervalMinutes?: number;
  lookbackDays?: number;
}

export async function connectMeta(input: ConnectMetaInput) {
  const existing = await getMetaCredential();
  const existingCreds = existing ? readCreds(existing.credenciaisEnc) : {};

  const appId = input.appId !== undefined ? input.appId.trim() : existingCreds.appId ?? "";
  const accessToken =
    input.accessToken && input.accessToken.trim()
      ? input.accessToken.trim()
      : existingCreds.accessToken ?? "";
  const adAccountId =
    input.adAccountId !== undefined ? input.adAccountId.trim() : existing?.segmentoId ?? "";

  if (!accessToken) throw new Error("Informe o access token (permissão ads_read).");
  if (!adAccountId) throw new Error("Informe o ID da conta de anúncios (act_...).");

  const syncIntervalMinutes =
    input.syncIntervalMinutes !== undefined
      ? Math.max(MIN_SYNC_INTERVAL_MINUTES, Math.floor(input.syncIntervalMinutes))
      : existing?.syncIntervalMinutes ?? 360;
  const lookbackDays =
    input.lookbackDays !== undefined
      ? Math.min(MAX_LOOKBACK_DAYS, Math.max(1, Math.floor(input.lookbackDays)))
      : existing?.lookbackDays ?? 7;
  const syncEnabled = input.syncEnabled !== undefined ? input.syncEnabled : existing?.syncEnabled ?? false;

  // Testa a conexao antes de salvar como "conectado".
  let statusConexao = "erro";
  let statusMensagem: string | null = null;
  let currency = existingCreds.currency ?? "BRL";
  try {
    const info = await testMetaConnection(accessToken, adAccountId);
    currency = info.currency || "BRL";
    statusConexao = "conectado";
    statusMensagem = `Conta: ${info.name} (${currency})`;
  } catch (err) {
    statusConexao = "erro";
    statusMensagem = err instanceof Error ? err.message : "Falha ao conectar na Meta.";
  }

  const credenciaisEnc = encryptSecret(JSON.stringify({ appId, accessToken, currency }));

  const data = {
    tipoAutenticacao: "token",
    credenciaisEnc,
    segmentoId: adAccountId,
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
  return getMetaStatus();
}

export async function testMeta() {
  const row = await getMetaCredential();
  if (!row) throw new Error("Meta não configurada.");
  const creds = readCreds(row.credenciaisEnc);
  if (!creds.accessToken || !row.segmentoId) throw new Error("Credenciais incompletas.");
  try {
    const info = await testMetaConnection(creds.accessToken, row.segmentoId);
    await prisma.integrationCredential.update({
      where: { plataforma: PLATAFORMA },
      data: { statusConexao: "conectado", statusMensagem: `Conta: ${info.name} (${info.currency})` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao conectar na Meta.";
    await prisma.integrationCredential.update({
      where: { plataforma: PLATAFORMA },
      data: { statusConexao: "erro", statusMensagem: msg },
    });
    throw new Error(msg);
  }
  return getMetaStatus();
}

export async function disconnectMeta() {
  await prisma.integrationCredential.deleteMany({ where: { plataforma: PLATAFORMA } });
  return { ok: true };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Puxa o gasto por campanha/dia dos ultimos `lookbackDays` e grava como
 * lancamentos de GASTO. Dedupe por referenciaExterna = "meta:{campanha}:{data}":
 * se ja existe, atualiza o valor (a Meta ajusta numeros ate consolidar); senao cria.
 */
export async function runMetaSync(): Promise<{ imported: number; updated: number; total: number }> {
  const row = await getMetaCredential();
  if (!row) throw new Error("Meta não configurada.");
  const creds = readCreds(row.credenciaisEnc);
  if (!creds.accessToken || !row.segmentoId) throw new Error("Credenciais incompletas.");

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (row.lookbackDays - 1));
  const currency = creds.currency || "BRL";

  let rows;
  try {
    rows = await fetchCampaignSpend(creds.accessToken, row.segmentoId, ymd(since), ymd(until));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao sincronizar com a Meta.";
    await prisma.integrationCredential.update({
      where: { plataforma: PLATAFORMA },
      data: { statusConexao: "erro", statusMensagem: msg },
    });
    throw new Error(msg);
  }

  let imported = 0;
  let updated = 0;
  for (const r of rows) {
    const referenciaExterna = `meta:${r.campaignId}:${r.date}`;
    const valorCents = Math.round(r.spend * 100);
    const existing = await prisma.financialEntry.findFirst({
      where: { plataforma: PLATAFORMA, referenciaExterna },
    });
    if (existing) {
      await prisma.financialEntry.update({
        where: { id: existing.id },
        data: {
          valorCents,
          descricao: r.campaignName,
          dataSincronizacao: new Date(),
          moeda: currency,
        },
      });
      updated++;
    } else {
      await prisma.financialEntry.create({
        data: {
          tipo: "gasto",
          plataforma: PLATAFORMA,
          valorCents,
          moeda: currency,
          status: "pago",
          dataEvento: new Date(`${r.date}T12:00:00`),
          dataSincronizacao: new Date(),
          origem: "api",
          referenciaExterna,
          descricao: r.campaignName,
        },
      });
      imported++;
    }
  }

  await prisma.integrationCredential.update({
    where: { plataforma: PLATAFORMA },
    data: {
      statusConexao: "conectado",
      statusMensagem: `Última sync: ${imported} novo(s), ${updated} atualizado(s).`,
      ultimaSincronizacao: new Date(),
    },
  });

  return { imported, updated, total: rows.length };
}

let syncing = false;

async function maybeRunScheduledSync(): Promise<void> {
  const row = await getMetaCredential();
  if (!row || !row.syncEnabled) return;
  if (syncing) return;

  const now = Date.now();
  const last = row.ultimaSincronizacao ? row.ultimaSincronizacao.getTime() : 0;
  const dueAt = last + row.syncIntervalMinutes * 60_000;
  if (last && now < dueAt) return;

  syncing = true;
  try {
    const result = await runMetaSync();
    console.log(`[meta-sync] ${result.imported} novo(s), ${result.updated} atualizado(s).`);
  } catch (err) {
    console.error("[meta-sync] Erro na sincronização:", err instanceof Error ? err.message : err);
  } finally {
    syncing = false;
  }
}

export function startMetaSyncLoop(): NodeJS.Timeout {
  return setInterval(() => {
    maybeRunScheduledSync().catch((err) => console.error("[meta-sync] Erro no loop:", err));
  }, CHECK_INTERVAL_MS);
}
