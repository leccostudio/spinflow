import { prisma } from "../db/client.js";
import { getDedupeWindowHours } from "../config/settings.js";

/**
 * Chave de deduplicacao: host + path, sem query string (a maior parte do
 * "id do produto" mora no path nos 3 marketplaces suportados; query string
 * costuma ser só parametro de rastreio).
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export async function isDuplicate(dedupeKey: string): Promise<boolean> {
  const windowHours = await getDedupeWindowHours();
  if (windowHours <= 0) return false;

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const existing = await prisma.capturedProduct.findFirst({
    where: { dedupeKey, capturedAt: { gte: since } },
  });
  return Boolean(existing);
}
