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
import { registerCaptureListener } from "../capture/listener.js";
import { registerAutomationListener } from "../automation/listener.js";

const logger = pino({ level: "silent" });
const sockets = new Map<string, WASocket>();
// QR mais recente (string crua) por conta - Baileys reemite um novo a cada ~20s ate escanear.
const latestQr = new Map<string, string>();

function authDirFor(name: string): string {
  return path.join(process.cwd(), "data", "auth", name);
}

async function ensureAccountRow(name: string): Promise<string> {
  const existing = await prisma.whatsAppAccount.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.whatsAppAccount.create({
    data: { name, authDir: authDirFor(name), status: "DISCONNECTED" },
  });
  return created.id;
}

/** Socket de uma conta especifica (precisa estar conectada). */
export function getSocketForAccount(accountId: string): WASocket | undefined {
  return sockets.get(accountId);
}

/** Qualquer conta conectada — usado onde a conta especifica nao importa. */
export function getSocket(): WASocket {
  const first = sockets.values().next();
  if (first.done) throw new Error("Nenhuma conta WhatsApp conectada ainda.");
  return first.value;
}

/** QR cru (string) mais recente de uma conta aguardando pareamento, se houver. */
export function getLatestQr(accountId: string): string | undefined {
  return latestQr.get(accountId);
}

async function connectAccount(accountId: string, name: string): Promise<void> {
  const authDir = authDirFor(name);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);
  registerCaptureListener(sock);
  registerAutomationListener(sock);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(
        `\nEscaneie o QR code abaixo pra conta "${name}" (WhatsApp > Aparelhos conectados > Conectar aparelho) — ou veja em Contas WhatsApp no painel:\n`
      );
      qrcodeTerminal.generate(qr, { small: true });
      latestQr.set(accountId, qr);
      await prisma.whatsAppAccount.update({ where: { id: accountId }, data: { status: "CONNECTING" } });
    }

    if (connection === "open") {
      latestQr.delete(accountId);
      sockets.set(accountId, sock);
      const phoneNumber = sock.user?.id?.split(":")[0];
      console.log(`WhatsApp "${name}" conectado${phoneNumber ? ` (${phoneNumber})` : ""}.`);
      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { status: "CONNECTED", phoneNumber },
      });
      await syncGroups(accountId, sock);
    }

    if (connection === "close") {
      sockets.delete(accountId);
      latestQr.delete(accountId);
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      await prisma.whatsAppAccount.update({ where: { id: accountId }, data: { status: "DISCONNECTED" } });

      if (loggedOut) {
        console.log(
          `Sessão "${name}" encerrada (logout). Apague data/auth/${name} e reconecte com um novo QR code.`
        );
        return;
      }

      console.log(`Conexão "${name}" perdida, tentando reconectar...`);
      await connectAccount(accountId, name);
    }
  });
}

/** Cria (se preciso) e conecta uma conta pelo nome. Retorna o accountId. */
export async function startAccount(name: string): Promise<string> {
  const accountId = await ensureAccountRow(name);
  await connectAccount(accountId, name);
  return accountId;
}

/** Reconecta todas as contas ja conhecidas; cria "default" se nao existir nenhuma. */
export async function startAllAccounts(): Promise<void> {
  const existing = await prisma.whatsAppAccount.findMany();
  if (existing.length === 0) {
    await startAccount("default");
    return;
  }
  await Promise.all(existing.map((account) => connectAccount(account.id, account.name)));
}
