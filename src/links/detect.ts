export type Marketplace = "shopee" | "amazon" | "mercadolivre" | "unknown";

const HOST_RULES: Array<{ marketplace: Marketplace; pattern: RegExp }> = [
  // shopee.com.br (+ s.shopee.com.br) e o encurtador global shp.ee
  { marketplace: "shopee", pattern: /(^|\.)(shopee\.com\.br|shp\.ee)$/i },
  // amazon.com.br + o encurtador oficial amzn.to
  { marketplace: "amazon", pattern: /(^|\.)(amazon\.com\.br|amzn\.to)$/i },
  // mercadolivre.com.br + o encurtador meli.la (confirmado em captura real)
  { marketplace: "mercadolivre", pattern: /(^|\.)(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)$/i },
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
