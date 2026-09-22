import { downloadMediaMessage, type WASocket, type proto } from "@whiskeysockets/baileys";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type WAMessage = proto.IWebMessageInfo;

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

/**
 * Baixa a imagem de uma mensagem capturada (quando o grupo monitorado tem
 * "usar imagem divulgada pelo grupo" ativado). Se a mensagem nao tiver
 * imagem, ou o download falhar, retorna undefined sem quebrar a captura.
 */
export async function downloadCapturedImage(
  sock: WASocket,
  message: WAMessage
): Promise<string | undefined> {
  if (!message.message?.imageMessage) return undefined;

  try {
    await mkdir(MEDIA_DIR, { recursive: true });
    const buffer = await downloadMediaMessage(
      message,
      "buffer",
      {},
      { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
    );

    const filePath = path.join(MEDIA_DIR, `${randomUUID()}.jpg`);
    await writeFile(filePath, buffer as Buffer);
    return filePath;
  } catch (err) {
    console.error("Falha ao baixar imagem da mensagem capturada:", err);
    return undefined;
  }
}
