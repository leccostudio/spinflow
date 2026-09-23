import type { WASocket, proto } from "@whiskeysockets/baileys";
import { prisma } from "../db/client.js";
import { extractLinks } from "./extractLinks.js";
import { passesKeywordFilter } from "./keywordFilter.js";
import { normalizeUrl, isDuplicate } from "./dedupe.js";
import { detectMarketplace } from "../links/detect.js";
import { convertLink } from "../links/convert.js";
import { downloadCapturedImage } from "./media.js";

type WAMessage = proto.IWebMessageInfo;

function getMessageText(message: WAMessage): string {
  const m = message.message;
  if (!m) return "";
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    ""
  );
}

export function registerCaptureListener(sock: WASocket): void {
  sock.ev.on("messages.upsert", async (event) => {
    console.log(`[captura] messages.upsert recebido: type=${event.type}, count=${event.messages.length}`);
    if (event.type !== "notify") return;

    for (const message of event.messages) {
      try {
        await handleMessage(sock, message);
      } catch (err) {
        console.error("Erro ao processar mensagem para captura:", err);
      }
    }
  });
}

async function handleMessage(sock: WASocket, message: WAMessage): Promise<void> {
  const jid = message.key.remoteJid;
  if (!jid || !jid.endsWith("@g.us")) return; // só grupos

  if (message.key.fromMe) {
    console.log(`[captura] Ignorada: mensagem enviada pelo próprio número conectado (jid=${jid}).`);
    return;
  }

  const group = await prisma.whatsAppGroup.findUnique({ where: { jid } });
  if (!group) {
    console.log(`[captura] Mensagem de grupo não cadastrado (jid=${jid}) — rode /whatsapp/groups/sync.`);
    return;
  }
  if (!group.isMonitoring) {
    console.log(`[captura] Ignorada: grupo "${group.name}" não está com monitoramento ativo.`);
    return;
  }

  const text = getMessageText(message);
  if (!text) {
    console.log(`[captura] Mensagem de "${group.name}" sem texto/legenda extraível — tipo:`, Object.keys(message.message ?? {}));
    return;
  }

  const links = extractLinks(text);
  if (links.length === 0) {
    console.log(`[captura] Mensagem de "${group.name}" sem link reconhecível: "${text.slice(0, 80)}"`);
    return;
  }

  const allowedMarketplaces = group.monitoredMarketplaces
    ? group.monitoredMarketplaces.split(",").map((m) => m.trim())
    : [];

  // Baixa uma vez só e reaproveita pra todos os links dessa mesma mensagem.
  const imagePath = group.useOriginalImage
    ? await downloadCapturedImage(sock, message)
    : undefined;

  for (const link of links) {
    const marketplace = detectMarketplace(link);
    if (marketplace === "unknown") {
      console.log(`[captura] Link ignorado (marketplace não reconhecido): ${link}`);
      continue;
    }
    if (allowedMarketplaces.length > 0 && !allowedMarketplaces.includes(marketplace)) {
      console.log(
        `[captura] Link ignorado: "${marketplace}" não está na lista de marketplaces do grupo "${group.name}" (${group.monitoredMarketplaces}).`
      );
      continue;
    }
    if (!(await passesKeywordFilter(text))) {
      console.log(`[captura] Mensagem bloqueada pelo filtro de palavras.`);
      continue;
    }

    const dedupeKey = normalizeUrl(link);
    if (await isDuplicate(dedupeKey)) {
      console.log(`[captura] Ignorado: produto duplicado dentro da janela de dedupe (${link}).`);
      continue;
    }

    let affiliateUrl: string | undefined;
    let conversionError: string | undefined;
    let status = "CAPTURED";

    try {
      const result = await convertLink(link);
      affiliateUrl = result.affiliateUrl;
      status = result.method === "manual" ? "CAPTURED" : "CONVERTED";
    } catch (err) {
      conversionError = err instanceof Error ? err.message : "Erro desconhecido na conversão.";
      status = "CONVERSION_FAILED";
    }

    await prisma.capturedProduct.create({
      data: {
        sourceUrl: link,
        dedupeKey,
        marketplace,
        affiliateUrl,
        conversionError,
        status,
        messageText: text.slice(0, 2000),
        imagePath,
        sourceGroupId: group.id,
      },
    });

    console.log(`Produto capturado [${marketplace}] do grupo "${group.name}": ${link}`);
  }
}
