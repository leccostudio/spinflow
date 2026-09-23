import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { getSocketForAccount, startAccount } from "../whatsapp/baileys.js";
import { syncGroups } from "../whatsapp/groups.js";
import { convertLink } from "../links/convert.js";
import { renderProductWithTemplate } from "../templates/service.js";
import { sendTextToGroups } from "../messages/send.js";
import { createScheduledMessage, cancelScheduledMessage } from "../scheduler/scheduled.js";
import { getAutoDispatchSettings, updateAutoDispatchSettings } from "../scheduler/autoDispatch.js";

export async function apiRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/whatsapp/status", async () => {
    const account = await prisma.whatsAppAccount.findFirst({ orderBy: { createdAt: "asc" } });
    return account ?? { status: "DISCONNECTED" };
  });

  // --- Contas WhatsApp (multi-numero / failover) ---

  app.get("/whatsapp/accounts", async () => {
    return prisma.whatsAppAccount.findMany({ orderBy: { createdAt: "asc" } });
  });

  app.post<{ Body: { name?: string } }>("/whatsapp/accounts", async (request, reply) => {
    const { name } = request.body ?? {};
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: "Campo 'name' é obrigatório." });
    }
    const existing = await prisma.whatsAppAccount.findFirst({ where: { name: name.trim() } });
    if (existing) {
      return reply.code(409).send({ error: "Já existe uma conta com esse nome." });
    }

    // Nao espera a conexao completar (QR aparece nos logs do servidor) - so dispara.
    startAccount(name.trim()).catch((err) => console.error("Falha ao iniciar conta:", err));
    return reply.code(202).send({ message: `Conta "${name}" sendo iniciada — veja o QR nos logs do servidor.` });
  });

  app.get("/whatsapp/groups", async () => {
    return prisma.whatsAppGroup.findMany({ orderBy: { name: "asc" } });
  });

  app.post<{ Body: { accountId?: string } }>("/whatsapp/groups/sync", async (request, reply) => {
    const { accountId } = request.body ?? {};
    const account = accountId
      ? await prisma.whatsAppAccount.findUnique({ where: { id: accountId } })
      : await prisma.whatsAppAccount.findFirst({ orderBy: { createdAt: "asc" } });
    if (!account) {
      return reply.code(409).send({ error: "Nenhuma conta WhatsApp inicializada ainda." });
    }
    const sock = getSocketForAccount(account.id);
    if (!sock) {
      return reply.code(503).send({ error: `Conta "${account.name}" não está conectada.` });
    }
    return syncGroups(account.id, sock);
  });

  app.patch<{
    Params: { id: string };
    Body: {
      isMonitoring?: boolean;
      isSending?: boolean;
      monitoredMarketplaces?: string[];
      useOriginalImage?: boolean;
      isAutomationGroup?: boolean;
      backupAccountId?: string | null;
    };
  }>("/whatsapp/groups/:id", async (request, reply) => {
    const { id } = request.params;
    const {
      isMonitoring,
      isSending,
      monitoredMarketplaces,
      useOriginalImage,
      isAutomationGroup,
      backupAccountId,
    } = request.body;
    const group = await prisma.whatsAppGroup.findUnique({ where: { id } });
    if (!group) {
      return reply.code(404).send({ error: "Grupo não encontrado." });
    }
    if (backupAccountId && backupAccountId === group.accountId) {
      return reply.code(400).send({ error: "A conta de backup não pode ser a mesma que a principal." });
    }

    // So um grupo pode ser o "Grupo de Automação" por vez.
    if (isAutomationGroup === true) {
      await prisma.whatsAppGroup.updateMany({
        where: { isAutomationGroup: true, id: { not: id } },
        data: { isAutomationGroup: false },
      });
    }

    return prisma.whatsAppGroup.update({
      where: { id },
      data: {
        ...(isMonitoring !== undefined ? { isMonitoring } : {}),
        ...(isSending !== undefined ? { isSending } : {}),
        ...(monitoredMarketplaces !== undefined
          ? { monitoredMarketplaces: monitoredMarketplaces.join(",") }
          : {}),
        ...(useOriginalImage !== undefined ? { useOriginalImage } : {}),
        ...(isAutomationGroup !== undefined ? { isAutomationGroup } : {}),
        ...(backupAccountId !== undefined ? { backupAccountId } : {}),
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
    let imagePath: string | null | undefined;
    try {
      if (!finalText && productId) {
        const rendered = await renderProductWithTemplate(productId, templateId);
        finalText = rendered.text;
        const product = await prisma.capturedProduct.findUnique({ where: { id: productId } });
        previewUrl = product?.affiliateUrl ?? product?.sourceUrl;
        imagePath = product?.imagePath;
      }
      if (!finalText) {
        return reply
          .code(400)
          .send({ error: "Forneça 'text' diretamente ou 'productId' para renderizar via template." });
      }

      const results = await sendTextToGroups(groupIds, finalText, { previewUrl, imagePath });
      return { text: finalText, results };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido no envio.";
      const notConnected = message.includes("não foi inicializado");
      return reply.code(notConnected ? 503 : 400).send({ error: message });
    }
  });

  // --- Agendamentos ---

  app.get<{ Querystring: { status?: string } }>("/messages/scheduled", async (request) => {
    const { status } = request.query;
    return prisma.scheduledMessage.findMany({
      where: status ? { status } : {},
      orderBy: { scheduledAt: "asc" },
    });
  });

  app.post<{
    Body: {
      groupIds: string[];
      scheduledAt: string;
      text?: string;
      productId?: string;
      templateId?: string;
    };
  }>("/messages/scheduled", async (request, reply) => {
    const { groupIds, scheduledAt, text, productId, templateId } = request.body;
    if (!groupIds || groupIds.length === 0) {
      return reply.code(400).send({ error: "Campo 'groupIds' é obrigatório e não pode ser vazio." });
    }
    if (!scheduledAt) {
      return reply.code(400).send({ error: "Campo 'scheduledAt' é obrigatório (ISO 8601)." });
    }

    try {
      const job = await createScheduledMessage({
        groupIds,
        scheduledAt: new Date(scheduledAt),
        text,
        productId,
        templateId,
      });
      return job;
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Erro ao agendar mensagem." });
    }
  });

  app.delete<{ Params: { id: string } }>("/messages/scheduled/:id", async (request, reply) => {
    try {
      return await cancelScheduledMessage(request.params.id);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Erro ao cancelar agendamento." });
    }
  });

  // --- Disparo automático ---

  app.get("/auto-dispatch", async () => {
    return getAutoDispatchSettings();
  });

  app.patch<{
    Body: {
      enabled?: boolean;
      startHour?: number;
      endHour?: number;
      minIntervalMinutes?: number;
      maxIntervalMinutes?: number;
      minProductsPerRun?: number;
      maxProductsPerRun?: number;
    };
  }>("/auto-dispatch", async (request, reply) => {
    try {
      return await updateAutoDispatchSettings(request.body);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Erro ao atualizar configuração." });
    }
  });
}
