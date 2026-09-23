import { prisma } from "../db/client.js";

const ID = "singleton";

function splitWords(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// --- Plataformas (Shopee/Amazon/Mercado Livre) ---

export async function getPlatformSettings() {
  return (
    (await prisma.platformSettings.findUnique({ where: { id: ID } })) ??
    prisma.platformSettings.create({ data: { id: ID } })
  );
}

export async function updatePlatformSettings(input: {
  shopeeAppId?: string;
  shopeeAppSecret?: string;
  shopeeSubIds?: string;
  amazonAffiliateTag?: string;
  mercadoLivreTag?: string;
  mercadoLivreCode?: string;
}) {
  await getPlatformSettings();
  return prisma.platformSettings.update({ where: { id: ID }, data: input });
}

export async function isShopeeConfigured(): Promise<boolean> {
  const s = await getPlatformSettings();
  return Boolean(s.shopeeAppId && s.shopeeAppSecret);
}

export async function isAmazonConfigured(): Promise<boolean> {
  const s = await getPlatformSettings();
  return Boolean(s.amazonAffiliateTag);
}

export async function isMercadoLivreConfigured(): Promise<boolean> {
  const s = await getPlatformSettings();
  return Boolean(s.mercadoLivreTag && s.mercadoLivreCode);
}

export async function getShopeeSubIds(): Promise<string[]> {
  const s = await getPlatformSettings();
  return splitWords(s.shopeeSubIds);
}

// --- Monitoramento (palavras restritas/permitidas, dedupe) ---

export async function getMonitoringSettings() {
  return (
    (await prisma.monitoringSettings.findUnique({ where: { id: ID } })) ??
    prisma.monitoringSettings.create({ data: { id: ID } })
  );
}

export async function updateMonitoringSettings(input: {
  restrictedWords?: string;
  allowedWords?: string;
  dedupeWindowHours?: number;
}) {
  await getMonitoringSettings();
  return prisma.monitoringSettings.update({ where: { id: ID }, data: input });
}

export async function getRestrictedWords(): Promise<string[]> {
  const s = await getMonitoringSettings();
  return splitWords(s.restrictedWords);
}

export async function getAllowedWords(): Promise<string[]> {
  const s = await getMonitoringSettings();
  return splitWords(s.allowedWords);
}

export async function getDedupeWindowHours(): Promise<number> {
  const s = await getMonitoringSettings();
  return s.dedupeWindowHours;
}
