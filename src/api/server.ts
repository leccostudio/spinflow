import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../db/client.js";
import { getSocket } from "../whatsapp/baileys.js";
import { syncGroups } from "../whatsapp/groups.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true }));

  app.get("/whatsapp/status", async () => {
    const account = await prisma.whatsAppAccount.findFirst({ orderBy: { createdAt: "asc" } });
    return account ?? { status: "DISCONNECTED" };
  });

  app.get("/whatsapp/groups", async () => {
    return prisma.whatsAppGroup.findMany({ orderBy: { name: "asc" } });
  });

  app.post("/whatsapp/groups/sync", async (_request, reply) => {
    const account = await prisma.whatsAppAccount.findFirst({ orderBy: { createdAt: "asc" } });
    if (!account) {
      return reply.code(409).send({ error: "Nenhuma conta WhatsApp inicializada ainda." });
    }
    try {
      const sock = getSocket();
      return await syncGroups(account.id, sock);
    } catch {
      return reply.code(503).send({ error: "WhatsApp ainda não conectado." });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { isMonitoring?: boolean; isSending?: boolean };
  }>("/whatsapp/groups/:id", async (request, reply) => {
    const { id } = request.params;
    const { isMonitoring, isSending } = request.body;
    const group = await prisma.whatsAppGroup.findUnique({ where: { id } });
    if (!group) {
      return reply.code(404).send({ error: "Grupo não encontrado." });
    }

    return prisma.whatsAppGroup.update({
      where: { id },
      data: {
        ...(isMonitoring !== undefined ? { isMonitoring } : {}),
        ...(isSending !== undefined ? { isSending } : {}),
      },
    });
  });

  return app;
}
