import { env, isAmazonConfigured } from "../config/env.js";

/**
 * Amazon affiliate links don't need API calls: appending the associate tag
 * as a query param is enough for a valid tracked link.
 */
export function convertAmazonLink(originUrl: string): string {
  if (!isAmazonConfigured()) {
    throw new Error("Tag de afiliado da Amazon não configurada (AMAZON_AFFILIATE_TAG no .env).");
  }

  const url = new URL(originUrl);
  url.searchParams.set("tag", env.amazon.affiliateTag);
  return url.toString();
}
