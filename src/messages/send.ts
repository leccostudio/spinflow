import { getUrlInfo } from "@whiskeysockets/baileys";
import { prisma } from "../db/client.js";
import { getSocket } from "../whatsapp/baileys.js";
import { detectMarketplace } from "../links/detect.js";

export interface SendResult {
  groupId: string;
  groupName: string;
  jid: string;
  success: boolean;
  error?: string;
}

/**
 * Baileys tenta gerar link preview automaticamente pra qualquer URL que
 * aparecer no texto (usando o pacote link-preview-js, que tem uma
 * vulnerabilidade de SSRF conhecida sem correção — GHSA-4gp8-rjrq-ch6q).
 * Por isso NUNCA deixamos o auto-fetch dele rodar sobre texto livre: só
 * buscamos preview explicitamente quando a URL já passou pelo filtro de
 * marketplace conhecido (Shopee/Amazon/Mercado Livre) em outro lugar do
 * pipeline. Fora isso, mandamos `linkPreview: null` pra desativar o
 * comportamento automático.
 */
async function buildTrustedLinkPreview(url: string | undefined) {
  if (!url || detectMarketplace(url) === "unknown") return null;

  try {
    return (
      (await getUrlInfo(url, { thumbnailWidth: 192, fetchOpts: { timeout: 5000 } })) ?? null
    );
  } catch {
    return null; // sem preview nao deve quebrar o envio
  }
}

export async function sendTextToGroups(
  groupIds: string[],
  text: string,
  previewUrl?: string
): Promise<SendResult[]> {
  const groups = await prisma.whatsAppGroup.findMany({ where: { id: { in: groupIds } } });
  const sock = getSocket();
  const linkPreview = await buildTrustedLinkPreview(previewUrl);

  const results: SendResult[] = [];
  for (const group of groups) {
    try {
      await sock.sendMessage(group.jid, { text, linkPreview });
      results.push({ groupId: group.id, groupName: group.name, jid: group.jid, success: true });
    } catch (err) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        jid: group.jid,
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  }
  return results;
}
