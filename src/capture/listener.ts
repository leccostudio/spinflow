import type { WASocket, proto } from "@whiskeysockets/baileys";
import { prisma } from "../db/client.js";
import { extractLinks } from "./extractLinks.js";
import { passesKeywordFilter } from "./keywordFilter.js";
import { normalizeUrl, isDuplicate } from "./dedupe.js";
import { detectMarketplace } from "../links/detect.js";
import { convertLink } from "../links/convert.js";

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
    if (event.type !== "notify") return;

    for (const message of event.messages) {
      try {
        await handleMessage(message);
      } catch (err) {
        console.error("Erro ao processar mensagem para captura:", err);
      }
    }
  });
}

async function handleMessage(message: WAMessage): Promise<void> {
  const jid = message.key.remoteJid;
  if (!jid || !jid.endsWith("@g.us")) return; // só grupos
  if (message.key.fromMe) return;

  const group = await prisma.whatsAppGroup.findUnique({ where: { jid } });
  if (!group || !group.isMonitoring) return;

  const text = getMessageText(message);
  if (!text) return;

  const links = extractLinks(text);
  if (links.length === 0) return;

  const allowedMarketplaces = group.monitoredMarketplaces
    ? group.monitoredMarketplaces.split(",").map((m) => m.trim())
    : [];

  for (const link of links) {
    const marketplace = detectMarketplace(link);
    if (marketplace === "unknown") continue;
    if (allowedMarketplaces.length > 0 && !allowedMarketplaces.includes(marketplace)) continue;
    if (!passesKeywordFilter(text)) continue;

    const dedupeKey = normalizeUrl(link);
    if (await isDuplicate(dedupeKey)) continue;

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
        sourceGroupId: group.id,
      },
    });

    console.log(`Produto capturado [${marketplace}] do grupo "${group.name}": ${link}`);
  }
}
