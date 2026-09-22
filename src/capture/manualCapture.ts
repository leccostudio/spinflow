import { prisma } from "../db/client.js";
import { detectMarketplace } from "../links/detect.js";
import { convertLink } from "../links/convert.js";
import { normalizeUrl } from "./dedupe.js";
import type { CapturedProduct } from "@prisma/client";

/**
 * Usado pelos comandos `salvar:` / `salvar_prioridade:` do bot — captura
 * explicitamente disparada pelo usuário, então não passa pelo filtro de
 * dedupe (é uma decisão manual, não uma varredura passiva de grupo).
 */
export async function manuallyCaptureProduct(
  link: string,
  sourceGroupId: string,
  opts: { priority?: boolean } = {}
): Promise<CapturedProduct> {
  const marketplace = detectMarketplace(link);
  if (marketplace === "unknown") {
    throw new Error(`Marketplace não reconhecido para: ${link}`);
  }

  let affiliateUrl: string | undefined;
  let conversionError: string | undefined;
  let status = "CAPTURED";

  try {
    const result = await convertLink(link);
    affiliateUrl = result.affiliateUrl;
    status = result.method === "manual" ? "CAPTURED" : "CONVERTED";
  } catch (err) {
    conversionError = err instanceof Error ? err.message : "Erro desconhecido na conversão.";
    status = "CONVERSION_FAILED";
  }

  return prisma.capturedProduct.create({
    data: {
      sourceUrl: link,
      dedupeKey: normalizeUrl(link),
      marketplace,
      affiliateUrl,
      conversionError,
      status,
      messageText: link,
      priority: opts.priority ?? false,
      sourceGroupId,
    },
  });
}
