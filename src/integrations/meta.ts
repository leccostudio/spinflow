/**
 * Cliente minimo da Meta Marketing API (Graph API) - Ads Insights.
 * So leitura de gasto por campanha (permissao ads_read). Nada e persistido aqui.
 */
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaCampaignSpend {
  campaignId: string;
  campaignName: string;
  spend: number; // na moeda da conta
  date: string; // yyyy-mm-dd (date_start)
}

// Normaliza act_123 / 123 -> act_123
function normalizeAccountId(adAccountId: string): string {
  const id = adAccountId.trim();
  return id.startsWith("act_") ? id : `act_${id}`;
}

async function graphError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) return body.error.message;
  } catch {
    // ignora
  }
  return `HTTP ${res.status}`;
}

/**
 * Valida o token + conta chamando o endpoint da conta de anuncios.
 * Retorna { name, currency } em sucesso; lanca Error com a mensagem da Meta em falha.
 */
export async function testMetaConnection(
  accessToken: string,
  adAccountId: string
): Promise<{ name: string; currency: string }> {
  const acc = normalizeAccountId(adAccountId);
  const url = `${GRAPH_BASE}/${acc}?fields=name,currency,account_status&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await graphError(res));
  const data = (await res.json()) as { name?: string; currency?: string };
  return { name: data.name ?? acc, currency: data.currency ?? "BRL" };
}

/**
 * Puxa o gasto por campanha, um registro por campanha/dia (time_increment=1),
 * no intervalo [since, until] (datas yyyy-mm-dd). Segue a paginacao.
 */
export async function fetchCampaignSpend(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<MetaCampaignSpend[]> {
  const acc = normalizeAccountId(adAccountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  let url =
    `${GRAPH_BASE}/${acc}/insights` +
    `?level=campaign&fields=campaign_id,campaign_name,spend` +
    `&time_increment=1&time_range=${timeRange}&limit=500` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const out: MetaCampaignSpend[] = [];
  // trava de seguranca contra loop infinito de paginacao
  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(await graphError(res));
    const body = (await res.json()) as {
      data?: Array<{ campaign_id?: string; campaign_name?: string; spend?: string; date_start?: string }>;
      paging?: { next?: string };
    };
    for (const row of body.data ?? []) {
      if (!row.campaign_id || !row.date_start) continue;
      out.push({
        campaignId: row.campaign_id,
        campaignName: row.campaign_name ?? row.campaign_id,
        spend: Number(row.spend ?? 0) || 0,
        date: row.date_start,
      });
    }
    url = body.paging?.next ?? "";
  }
  return out;
}
