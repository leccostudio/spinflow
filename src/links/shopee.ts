import { createHash } from "node:crypto";
import { getPlatformSettings, getShopeeSubIds, isShopeeConfigured } from "../config/settings.js";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

interface ShopeeGraphQLResponse {
  data?: { generateShortLink?: { shortLink?: string } };
  errors?: Array<{ message: string }>;
}

export async function convertShopeeLink(originUrl: string, subIds?: string[]): Promise<string> {
  if (!(await isShopeeConfigured())) {
    throw new Error(
      "Credenciais da Shopee não configuradas (Configurações > Plataformas)."
    );
  }

  const settings = await getPlatformSettings();
  const ids = (subIds && subIds.length > 0 ? subIds : await getShopeeSubIds()).slice(0, 5);

  // Inline literal syntax to match the documented example exactly; JSON.stringify
  // safely escapes the URL as a valid GraphQL/JSON string literal.
  const query = `mutation{generateShortLink(input:{originUrl:${JSON.stringify(
    originUrl
  )},subIds:${JSON.stringify(ids)}}){shortLink}}`;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256")
    .update(`${settings.shopeeAppId}${timestamp}${payload}${settings.shopeeAppSecret}`)
    .digest("hex");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${settings.shopeeAppId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Shopee API respondeu ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as ShopeeGraphQLResponse;

  if (json.errors?.length) {
    throw new Error(`Shopee API retornou erro: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  const shortLink = json.data?.generateShortLink?.shortLink;
  if (!shortLink) {
    throw new Error("Shopee API não retornou um link encurtado.");
  }

  return shortLink;
}
