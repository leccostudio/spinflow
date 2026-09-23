import { getUrlInfo } from "@whiskeysockets/baileys";
import { readFile } from "node:fs/promises";
import { prisma } from "../db/client.js";
import { getSocketForAccount } from "../whatsapp/baileys.js";
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

export interface SendOptions {
  previewUrl?: string;
  imagePath?: string | null;
}

export async function sendTextToGroups(
  groupIds: string[],
  text: string,
  options: SendOptions = {}
): Promise<SendResult[]> {
  const groups = await prisma.whatsAppGroup.findMany({ where: { id: { in: groupIds } } });

  // Imagem original do grupo monitorado tem prioridade sobre link preview
  // gerado a partir da URL (mais confiável — não depende de tags og: que a
  // Shopee/Amazon costumam nem expor em links curtos).
  let imageBuffer: Buffer | null = null;
  if (options.imagePath) {
    try {
      imageBuffer = await readFile(options.imagePath);
    } catch (err) {
      console.error("Falha ao ler imagem capturada, seguindo sem ela:", err);
    }
  }

  const linkPreview = imageBuffer ? null : await buildTrustedLinkPreview(options.previewUrl);

  const results: SendResult[] = [];
  for (const group of groups) {
    try {
      // Tenta a conta principal do grupo; se estiver desconectada, cai pra
      // conta de backup (se configurada e tambem conectada).
      let sock = getSocketForAccount(group.accountId);
      let usedBackup = false;
      if (!sock && group.backupAccountId) {
        sock = getSocketForAccount(group.backupAccountId);
        usedBackup = true;
      }
      if (!sock) {
        throw new Error(
          group.backupAccountId
            ? "Nem a conta principal nem a de backup deste grupo estão conectadas."
            : "A conta WhatsApp deste grupo não está conectada (configure uma conta de backup para failover)."
        );
      }

      if (imageBuffer) {
        await sock.sendMessage(group.jid, { image: imageBuffer, caption: text });
      } else {
        await sock.sendMessage(group.jid, { text, linkPreview });
      }
      results.push({
        groupId: group.id,
        groupName: group.name + (usedBackup ? " (via backup)" : ""),
        jid: group.jid,
        success: true,
      });
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
