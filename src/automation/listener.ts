import type { WASocket, proto } from "@whiskeysockets/baileys";
import { prisma } from "../db/client.js";
import { parseCommand } from "./commands.js";
import { convertLink } from "../links/convert.js";
import { manuallyCaptureProduct } from "../capture/manualCapture.js";
import { renderProductWithTemplate } from "../templates/service.js";
import { sendTextToGroups } from "../messages/send.js";
import { updateAutoDispatchSettings } from "../scheduler/autoDispatch.js";

type WAMessage = proto.IWebMessageInfo;

function getMessageText(message: WAMessage): string {
  const m = message.message;
  if (!m) return "";
  return m.conversation ?? m.extendedTextMessage?.text ?? "";
}

/**
 * Bot "Grupo de Automação": um grupo designado onde comandos de texto
 * substituem o painel. So processa mensagens de um grupo com
 * isAutomationGroup=true — nenhum grupo tem isso por padrão, então este
 * listener fica inerte até o usuário designar um grupo explicitamente.
 */
export function registerAutomationListener(sock: WASocket): void {
  sock.ev.on("messages.upsert", async (event) => {
    if (event.type !== "notify") return;
    for (const message of event.messages) {
      try {
        await handleAutomationMessage(sock, message);
      } catch (err) {
        console.error("[automacao] Erro ao processar comando:", err);
      }
    }
  });
}

async function reply(sock: WASocket, jid: string, text: string): Promise<void> {
  await sock.sendMessage(jid, { text });
}

async function handleAutomationMessage(sock: WASocket, message: WAMessage): Promise<void> {
  const jid = message.key.remoteJid;
  if (!jid || !jid.endsWith("@g.us")) return;
  if (message.key.fromMe) return;

  const group = await prisma.whatsAppGroup.findUnique({ where: { jid } });
  if (!group || !group.isAutomationGroup) return;

  const text = getMessageText(message);
  if (!text) return;

  const command = parseCommand(text);

  switch (command.type) {
    case "dispatch": {
      await handleDispatch(sock, jid, command.link);
      return;
    }
    case "preview": {
      await handlePreview(sock, jid, command.link, group.id);
      return;
    }
    case "convert": {
      await handleConvert(sock, jid, command.link);
      return;
    }
    case "video": {
      await reply(sock, jid, "⚠️ Conversão de vídeo sem marca d'água ainda não implementada neste MVP.");
      return;
    }
    case "save": {
      await handleSave(sock, jid, command.link, command.priority, group.id);
      return;
    }
    case "broadcast": {
      await handleBroadcast(sock, jid, command.text);
      return;
    }
    case "toggleAutoDispatch": {
      await updateAutoDispatchSettings({ enabled: command.enabled });
      await reply(sock, jid, `✅ Disparo automático ${command.enabled ? "ativado" : "desativado"}.`);
      return;
    }
    case "unknown":
      return; // conversa normal no grupo, não é comando
  }
}

async function handleDispatch(sock: WASocket, automationJid: string, link: string): Promise<void> {
  const sendGroups = await prisma.whatsAppGroup.findMany({ where: { isSending: true } });
  if (sendGroups.length === 0) {
    await reply(sock, automationJid, "⚠️ Nenhum grupo de envio ativo — nada foi disparado.");
    return;
  }

  try {
    const product = await manuallyCaptureProduct(link, (await groupIdByJid(automationJid))!);
    const rendered = await renderProductWithTemplate(product.id);
    const results = await sendTextToGroups(
      sendGroups.map((g) => g.id),
      rendered.text,
      { previewUrl: product.affiliateUrl ?? product.sourceUrl, imagePath: product.imagePath }
    );
    const okCount = results.filter((r) => r.success).length;
    await reply(sock, automationJid, `✅ Disparado para ${okCount}/${results.length} grupo(s) de envio.`);
  } catch (err) {
    await reply(sock, automationJid, `❌ ${err instanceof Error ? err.message : "Erro ao disparar."}`);
  }
}

async function handlePreview(
  sock: WASocket,
  automationJid: string,
  link: string,
  automationGroupId: string
): Promise<void> {
  try {
    const product = await manuallyCaptureProduct(link, automationGroupId);
    const rendered = await renderProductWithTemplate(product.id);
    await reply(sock, automationJid, `👁 Preview:\n\n${rendered.text}`);
  } catch (err) {
    await reply(sock, automationJid, `❌ ${err instanceof Error ? err.message : "Erro ao gerar preview."}`);
  }
}

async function handleConvert(sock: WASocket, automationJid: string, link: string): Promise<void> {
  try {
    const result = await convertLink(link);
    await reply(sock, automationJid, `🔗 ${result.affiliateUrl}`);
  } catch (err) {
    await reply(sock, automationJid, `❌ ${err instanceof Error ? err.message : "Erro ao converter link."}`);
  }
}

async function handleSave(
  sock: WASocket,
  automationJid: string,
  link: string,
  priority: boolean,
  automationGroupId: string
): Promise<void> {
  try {
    await manuallyCaptureProduct(link, automationGroupId, { priority });
    await reply(
      sock,
      automationJid,
      `💾 Salvo${priority ? " com prioridade" : ""} no catálogo: ${link}`
    );
  } catch (err) {
    await reply(sock, automationJid, `❌ ${err instanceof Error ? err.message : "Erro ao salvar."}`);
  }
}

async function handleBroadcast(sock: WASocket, automationJid: string, text: string): Promise<void> {
  const sendGroups = await prisma.whatsAppGroup.findMany({ where: { isSending: true } });
  if (sendGroups.length === 0) {
    await reply(sock, automationJid, "⚠️ Nenhum grupo de envio ativo — nada foi enviado.");
    return;
  }

  const results = await sendTextToGroups(
    sendGroups.map((g) => g.id),
    text
  );
  const okCount = results.filter((r) => r.success).length;
  await reply(sock, automationJid, `✅ Comunicado enviado para ${okCount}/${results.length} grupo(s).`);
}

async function groupIdByJid(jid: string): Promise<string | undefined> {
  const group = await prisma.whatsAppGroup.findUnique({ where: { jid } });
  return group?.id;
}
