import { prisma } from "../db/client.js";
import { renderProductWithTemplate } from "../templates/service.js";
import { sendTextToGroups } from "../messages/send.js";

const SETTINGS_ID = "singleton";
const CHECK_INTERVAL_MS = 60_000;

/**
 * Guardrails baseados nos presets reais observados no mapeamento do BuboFlow:
 * "10-20 produtos a cada 5 min" e configs parecidas são a causa nº1 de ban.
 * Faixas seguras usadas na prática: 30-60min/1-3 produtos, ou 10-15min/1-2.
 */
const MIN_INTERVAL_FLOOR_MINUTES = 5;
const MAX_PRODUCTS_PER_RUN_CEILING = 5;

export interface AutoDispatchInput {
  enabled?: boolean;
  startHour?: number;
  endHour?: number;
  minIntervalMinutes?: number;
  maxIntervalMinutes?: number;
  minProductsPerRun?: number;
  maxProductsPerRun?: number;
}

export function validateGuardrails(input: AutoDispatchInput): string | null {
  if (input.minIntervalMinutes !== undefined && input.minIntervalMinutes < MIN_INTERVAL_FLOOR_MINUTES) {
    return `Intervalo mínimo não pode ser menor que ${MIN_INTERVAL_FLOOR_MINUTES} minutos — abaixo disso o risco de ban é muito alto.`;
  }
  if (
    input.maxProductsPerRun !== undefined &&
    input.maxProductsPerRun > MAX_PRODUCTS_PER_RUN_CEILING
  ) {
    return `Máximo de produtos por execução não pode passar de ${MAX_PRODUCTS_PER_RUN_CEILING} — envios em rajada custumam ser detectados como spam.`;
  }
  if (
    input.minIntervalMinutes !== undefined &&
    input.maxIntervalMinutes !== undefined &&
    input.minIntervalMinutes > input.maxIntervalMinutes
  ) {
    return "Intervalo mínimo não pode ser maior que o intervalo máximo.";
  }
  if (
    input.minProductsPerRun !== undefined &&
    input.maxProductsPerRun !== undefined &&
    input.minProductsPerRun > input.maxProductsPerRun
  ) {
    return "Mínimo de produtos por execução não pode ser maior que o máximo.";
  }
  if (input.startHour !== undefined && (input.startHour < 0 || input.startHour > 23)) {
    return "Horário de início deve estar entre 0 e 23.";
  }
  if (input.endHour !== undefined && (input.endHour < 0 || input.endHour > 23)) {
    return "Horário de fim deve estar entre 0 e 23.";
  }
  return null;
}

export async function getAutoDispatchSettings() {
  return (
    (await prisma.autoDispatchSettings.findUnique({ where: { id: SETTINGS_ID } })) ??
    prisma.autoDispatchSettings.create({ data: { id: SETTINGS_ID } })
  );
}

export async function updateAutoDispatchSettings(input: AutoDispatchInput) {
  const error = validateGuardrails(input);
  if (error) throw new Error(error);

  await getAutoDispatchSettings(); // garante que a linha singleton existe
  return prisma.autoDispatchSettings.update({ where: { id: SETTINGS_ID }, data: input });
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function pickProductsToDispatch(count: number) {
  return prisma.capturedProduct.findMany({
    where: {
      dispatchedAt: null,
      status: { in: ["CAPTURED", "CONVERTED"] },
    },
    orderBy: [{ priority: "desc" }, { capturedAt: "asc" }],
    take: count,
  });
}

async function runDispatchCycle(): Promise<void> {
  const settings = await getAutoDispatchSettings();
  if (!settings.enabled) return;

  const now = new Date();
  if (settings.nextRunAt && now < settings.nextRunAt) return;

  const hour = now.getHours();
  const withinWindow =
    settings.startHour <= settings.endHour
      ? hour >= settings.startHour && hour < settings.endHour
      : hour >= settings.startHour || hour < settings.endHour; // janela que cruza a meia-noite

  if (!withinWindow) {
    console.log("[disparo-automatico] Fora da janela de horário configurada, aguardando.");
    return;
  }

  const sendGroups = await prisma.whatsAppGroup.findMany({ where: { isSending: true } });
  if (sendGroups.length === 0) {
    console.log("[disparo-automatico] Nenhum grupo de envio ativo, nada a fazer.");
    return;
  }

  const quantity = randomInt(settings.minProductsPerRun, settings.maxProductsPerRun);
  const products = await pickProductsToDispatch(quantity);

  if (products.length === 0) {
    console.log("[disparo-automatico] Nenhum produto novo na fila.");
  }

  for (const product of products) {
    try {
      const rendered = await renderProductWithTemplate(product.id);
      await sendTextToGroups(
        sendGroups.map((g) => g.id),
        rendered.text,
        { previewUrl: product.affiliateUrl ?? product.sourceUrl, imagePath: product.imagePath }
      );
      await prisma.capturedProduct.update({
        where: { id: product.id },
        data: { dispatchedAt: new Date() },
      });
      console.log(`[disparo-automatico] Enviado produto ${product.id} (${product.marketplace}).`);
    } catch (err) {
      console.error(`[disparo-automatico] Falha ao enviar produto ${product.id}:`, err);
    }
  }

  const intervalMinutes = randomInt(settings.minIntervalMinutes, settings.maxIntervalMinutes);
  const nextRunAt = new Date(Date.now() + intervalMinutes * 60_000);
  await prisma.autoDispatchSettings.update({
    where: { id: SETTINGS_ID },
    data: { lastRunAt: now, nextRunAt },
  });
  console.log(`[disparo-automatico] Próxima execução às ${nextRunAt.toLocaleTimeString("pt-BR")}.`);
}

export function startAutoDispatchLoop(): NodeJS.Timeout {
  return setInterval(() => {
    runDispatchCycle().catch((err) => console.error("[disparo-automatico] Erro no ciclo:", err));
  }, CHECK_INTERVAL_MS);
}
