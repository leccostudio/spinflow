export const env = {
  port: Number(process.env.PORT ?? 3333),

  shopee: {
    appId: process.env.SHOPEE_APP_ID ?? "",
    appSecret: process.env.SHOPEE_APP_SECRET ?? "",
    subIds: (process.env.SHOPEE_SUB_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  amazon: {
    affiliateTag: process.env.AMAZON_AFFILIATE_TAG ?? "",
  },

  mercadoLivre: {
    tag: process.env.MERCADOLIVRE_TAG ?? "",
  },

  monitoring: {
    restrictedWords: splitWords(process.env.RESTRICTED_WORDS),
    allowedWords: splitWords(process.env.ALLOWED_WORDS),
    dedupeWindowHours: Number(process.env.DEDUPE_WINDOW_HOURS ?? 12),
  },
};

function splitWords(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isShopeeConfigured(): boolean {
  return Boolean(env.shopee.appId && env.shopee.appSecret);
}

export function isAmazonConfigured(): boolean {
  return Boolean(env.amazon.affiliateTag);
}
