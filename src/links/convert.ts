import { detectMarketplace } from "./detect.js";
import { convertShopeeLink } from "./shopee.js";
import { convertAmazonLink } from "./amazon.js";
import { convertMercadoLivreLink } from "./mercadolivre.js";

export interface LinkConversionResult {
  marketplace: string;
  originalUrl: string;
  affiliateUrl: string;
  method: "api" | "tag" | "manual";
  note?: string;
}

export async function convertLink(originUrl: string, subIds?: string[]): Promise<LinkConversionResult> {
  const marketplace = detectMarketplace(originUrl);

  switch (marketplace) {
    case "shopee": {
      const affiliateUrl = await convertShopeeLink(originUrl, subIds);
      return { marketplace, originalUrl: originUrl, affiliateUrl, method: "api" };
    }
    case "amazon": {
      const affiliateUrl = await convertAmazonLink(originUrl);
      return { marketplace, originalUrl: originUrl, affiliateUrl, method: "tag" };
    }
    case "mercadolivre": {
      const { url } = convertMercadoLivreLink(originUrl);
      return {
        marketplace,
        originalUrl: originUrl,
        affiliateUrl: url,
        method: "manual",
        note: "Mercado Livre ainda não tem conversão automática neste MVP — converta manualmente no portal de afiliados do ML e cole o link resultante.",
      };
    }
    default:
      throw new Error(`Não foi possível identificar o marketplace do link: ${originUrl}`);
  }
}
