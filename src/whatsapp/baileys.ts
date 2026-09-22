import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import path from "node:path";
import { prisma } from "../db/client.js";
import { syncGroups } from "./groups.js";

const ACCOUNT_NAME = "default";
const AUTH_DIR = path.join(process.cwd(), "data", "auth", ACCOUNT_NAME);

const logger = pino({ level: "silent" });

let sock: WASocket | undefined;
let accountId: string | undefined;

async function ensureAccountRow(): Promise<string> {
  const existing = await prisma.whatsAppAccount.findFirst({ where: { name: ACCOUNT_NAME } });
  if (existing) return existing.id;
  const created = await prisma.whatsAppAccount.create({
    data: { name: ACCOUNT_NAME, authDir: AUTH_DIR, status: "DISCONNECTED" },
  });
  return created.id;
}

export function getSocket(): WASocket {
  if (!sock) throw new Error("WhatsApp socket ainda não foi inicializado.");
  return sock;
}

export async function startWhatsApp(): Promise<void> {
  accountId = await ensureAccountRow();
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(
        "\nEscaneie o QR code abaixo no WhatsApp (Aparelhos conectados > Conectar aparelho):\n"
      );
      qrcodeTerminal.generate(qr, { small: true });
      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { status: "CONNECTING" },
      });
    }

    if (connection === "open") {
      const phoneNumber = sock?.user?.id?.split(":")[0];
      console.log(`WhatsApp conectado${phoneNumber ? ` (${phoneNumber})` : ""}.`);
      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { status: "CONNECTED", phoneNumber },
      });
      await syncGroups(accountId!, sock!);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      await prisma.whatsAppAccount.update({
        where: { id: accountId! },
        data: { status: "DISCONNECTED" },
      });

      if (loggedOut) {
        console.log(
          "Sessão do WhatsApp encerrada (logout). Apague a pasta data/auth e reconecte com um novo QR code."
        );
        return;
      }

      console.log("Conexão perdida, tentando reconectar...");
      await startWhatsApp();
    }
  });
}
