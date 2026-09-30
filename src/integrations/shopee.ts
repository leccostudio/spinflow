import { createHash } from "node:crypto";

/**
 * Cliente da Shopee Affiliate Open API (GraphQL) para os relatorios de
 * conversao/validacao. Mesma autenticacao assinada usada na geracao de link
 * (src/links/shopee.ts): header
 *   Authorization: SHA256 Credential={appId}, Timestamp={ts}, Signature={sig}
 *   sig = sha256hex(appId + timestamp + payload + appSecret)
 *
 * ATENCAO: os nomes exatos dos campos do GraphQL (conversionReport /
 * validatedReport) seguem a doc publica da Shopee, mas so podem ser confirmados
 * com credenciais APROVADAS chamando a API de verdade. Se algum campo estiver
 * diferente, a Shopee responde com erro de GraphQL (visivel no "Testar
 * conexao") e ajustamos aqui. O parsing e defensivo pra tolerar variacoes.
 */
const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

export type ShopeeReportKind = "conversion" | "validated";

export interface ShopeeOrderCommission {
  orderId: string;
  commission: number; // na moeda da conta (BRL)
  status: string; // status cru vindo da Shopee
  purchaseTime: number; // unix seconds
}

interface GraphQLResp<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

function signedHeaders(appId: string, appSecret: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256")
    .update(`${appId}${timestamp}${payload}${appSecret}`)
    .digest("hex");
  return {
    "Content-Type": "application/json",
    Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
  };
}

async function callGraphQL<T>(appId: string, appSecret: string, query: string): Promise<T> {
  const payload = JSON.stringify({ query });
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: signedHeaders(appId, appSecret, payload),
    body: payload,
  });
  if (!res.ok) {
    throw new Error(`Shopee respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as GraphQLResp<T>;
  if (json.errors?.length) {
    throw new Error(`Shopee retornou erro: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Shopee não retornou dados.");
  return json.data;
}

// Teste leve de credenciais: puxa 1 registro do ultimo dia. Se as credenciais
// ou a assinatura estiverem erradas, a Shopee responde com erro de auth.
export async function testShopeeConnection(appId: string, appSecret: string): Promise<void> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 24 * 3600;
  const query = `{conversionReport(purchaseTimeStart:${start},purchaseTimeEnd:${end},limit:1){nodes{conversionId} pageInfo{hasNextPage scrollId}}}`;
  await callGraphQL(appId, appSecret, query);
}

interface ReportNode {
  conversionId?: string;
  purchaseTime?: number;
  orders?: Array<{
    orderId?: string;
    orderStatus?: string;
    items?: Array<{ itemTotalCommission?: string | number; orderStatus?: string }>;
  }>;
}
interface ReportData {
  conversionReport?: { nodes?: ReportNode[]; pageInfo?: { hasNextPage?: boolean; scrollId?: string } };
  validatedReport?: { nodes?: ReportNode[]; pageInfo?: { hasNextPage?: boolean; scrollId?: string } };
}

function buildQuery(kind: ShopeeReportKind, start: number, end: number, scrollId: string): string {
  const field = kind === "conversion" ? "conversionReport" : "validatedReport";
  const scroll = scrollId ? `,scrollId:${JSON.stringify(scrollId)}` : "";
  return `{${field}(purchaseTimeStart:${start},purchaseTimeEnd:${end},limit:100${scroll}){nodes{conversionId purchaseTime orders{orderId orderStatus items{itemTotalCommission orderStatus}}} pageInfo{hasNextPage scrollId}}}`;
}

/**
 * Puxa um relatorio (conversao ou validado) no intervalo [since, until] (unix s),
 * paginando por scrollId, e devolve uma linha por PEDIDO (order), com a comissao
 * somada dos itens daquele pedido.
 */
export async function fetchShopeeReport(
  appId: string,
  appSecret: string,
  kind: ShopeeReportKind,
  since: number,
  until: number
): Promise<ShopeeOrderCommission[]> {
  const out: ShopeeOrderCommission[] = [];
  let scrollId = "";
  for (let page = 0; page < 100; page++) {
    const data = await callGraphQL<ReportData>(appId, appSecret, buildQuery(kind, since, until, scrollId));
    const report = kind === "conversion" ? data.conversionReport : data.validatedReport;
    const nodes = report?.nodes ?? [];
    for (const node of nodes) {
      const purchaseTime = Number(node.purchaseTime ?? 0) || 0;
      for (const order of node.orders ?? []) {
        if (!order.orderId) continue;
        const commission = (order.items ?? []).reduce(
          (sum, it) => sum + (Number(it.itemTotalCommission ?? 0) || 0),
          0
        );
        out.push({
          orderId: order.orderId,
          commission,
          status: order.orderStatus ?? node.orders?.[0]?.items?.[0]?.orderStatus ?? "",
          purchaseTime,
        });
      }
    }
    if (!report?.pageInfo?.hasNextPage || !report.pageInfo.scrollId) break;
    scrollId = report.pageInfo.scrollId;
  }
  return out;
}
