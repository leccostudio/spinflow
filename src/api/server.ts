import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../db/client.js";
import { getSocket } from "../whatsapp/baileys.js";
import { syncGroups } from "../whatsapp/groups.js";
import { convertLink } from "../links/convert.js";
import { renderProductWithTemplate } from "../templates/service.js";
import { sendTextToGroups } from "../messages/send.js";

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
    Body: { isMonitoring?: boolean; isSending?: boolean; monitoredMarketplaces?: string[] };
  }>("/whatsapp/groups/:id", async (request, reply) => {
    const { id } = request.params;
    const { isMonitoring, isSending, monitoredMarketplaces } = request.body;
    const group = await prisma.whatsAppGroup.findUnique({ where: { id } });
    if (!group) {
      return reply.code(404).send({ error: "Grupo não encontrado." });
    }

    return prisma.whatsAppGroup.update({
      where: { id },
      data: {
        ...(isMonitoring !== undefined ? { isMonitoring } : {}),
        ...(isSending !== undefined ? { isSending } : {}),
        ...(monitoredMarketplaces !== undefined
          ? { monitoredMarketplaces: monitoredMarketplaces.join(",") }
          : {}),
      },
    });
  });

  app.get<{ Querystring: { marketplace?: string; groupId?: string; status?: string } }>(
    "/products",
    async (request) => {
      const { marketplace, groupId, status } = request.query;
      return prisma.capturedProduct.findMany({
        where: {
          ...(marketplace ? { marketplace } : {}),
          ...(groupId ? { sourceGroupId: groupId } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: { capturedAt: "desc" },
        include: { sourceGroup: { select: { name: true } } },
      });
    }
  );

  app.post<{ Body: { url?: string; subIds?: string[] } }>("/links/convert", async (request, reply) => {
    const { url, subIds } = request.body ?? {};
    if (!url) {
      return reply.code(400).send({ error: "Campo 'url' é obrigatório." });
    }

    try {
      const result = await convertLink(url, subIds);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido na conversão.";
      const notConfigured = message.includes("não configurad");
      return reply.code(notConfigured ? 503 : 400).send({ error: message });
    }
  });

  // --- Templates ---

  app.get("/templates", async () => {
    return prisma.messageTemplate.findMany({ orderBy: { createdAt: "asc" } });
  });

  app.post<{ Body: { name: string; marketplace?: string; content: string; isActive?: boolean } }>(
    "/templates",
    async (request, reply) => {
      const { name, marketplace, content, isActive } = request.body;
      if (!name || !content) {
        return reply.code(400).send({ error: "Campos 'name' e 'content' são obrigatórios." });
      }
      return prisma.messageTemplate.create({
        data: { name, marketplace: marketplace ?? "", content, isActive: isActive ?? true },
      });
    }
  );

  app.patch<{
    Params: { id: string };
    Body: { name?: string; marketplace?: string; content?: string; isActive?: boolean };
  }>("/templates/:id", async (request, reply) => {
    const { id } = request.params;
    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Template não encontrado." });
    return prisma.messageTemplate.update({ where: { id }, data: request.body });
  });

  app.delete<{ Params: { id: string } }>("/templates/:id", async (request, reply) => {
    const { id } = request.params;
    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Template não encontrado." });
    await prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { productId: string } }>(
    "/templates/:id/preview",
    async (request, reply) => {
      const { id } = request.params;
      const { productId } = request.body;
      if (!productId) return reply.code(400).send({ error: "Campo 'productId' é obrigatório." });

      try {
        const result = await renderProductWithTemplate(productId, id);
        return result;
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : "Erro ao renderizar template." });
      }
    }
  );

  // --- Envio manual ---

  app.post<{
    Body: { groupIds: string[]; text?: string; productId?: string; templateId?: string };
  }>("/messages/send", async (request, reply) => {
    const { groupIds, text, productId, templateId } = request.body;
    if (!groupIds || groupIds.length === 0) {
      return reply.code(400).send({ error: "Campo 'groupIds' é obrigatório e não pode ser vazio." });
    }

    let finalText = text;
    let previewUrl: string | undefined;
    try {
      if (!finalText && productId) {
        const rendered = await renderProductWithTemplate(productId, templateId);
        finalText = rendered.text;
        const product = await prisma.capturedProduct.findUnique({ where: { id: productId } });
        previewUrl = product?.affiliateUrl ?? product?.sourceUrl;
      }
      if (!finalText) {
        return reply
          .code(400)
          .send({ error: "Forneça 'text' diretamente ou 'productId' para renderizar via template." });
      }

      const results = await sendTextToGroups(groupIds, finalText, previewUrl);
      return { text: finalText, results };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido no envio.";
      const notConnected = message.includes("não foi inicializado");
      return reply.code(notConnected ? 503 : 400).send({ error: message });
    }
  });

  return app;
}
