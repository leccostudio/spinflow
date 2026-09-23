import { getPlatformSettings, isAmazonConfigured } from "../config/settings.js";

/**
 * Amazon affiliate links don't need API calls: appending the associate tag
 * as a query param is enough for a valid tracked link.
 */
export async function convertAmazonLink(originUrl: string): Promise<string> {
  if (!(await isAmazonConfigured())) {
    throw new Error("Tag de afiliado da Amazon não configurada (Configurações > Plataformas).");
  }

  const settings = await getPlatformSettings();
  const url = new URL(originUrl);
  url.searchParams.set("tag", settings.amazonAffiliateTag);
  return url.toString();
}
