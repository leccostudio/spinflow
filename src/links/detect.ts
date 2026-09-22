export type Marketplace = "shopee" | "amazon" | "mercadolivre" | "unknown";

const HOST_RULES: Array<{ marketplace: Marketplace; pattern: RegExp }> = [
  { marketplace: "shopee", pattern: /(^|\.)shopee\.com\.br$/i },
  { marketplace: "amazon", pattern: /(^|\.)amazon\.com\.br$/i },
  { marketplace: "mercadolivre", pattern: /(^|\.)(mercadolivre\.com\.br|mercadolibre\.com)$/i },
];

export function detectMarketplace(rawUrl: string): Marketplace {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    return "unknown";
  }

  const match = HOST_RULES.find((rule) => rule.pattern.test(hostname));
  return match?.marketplace ?? "unknown";
}
