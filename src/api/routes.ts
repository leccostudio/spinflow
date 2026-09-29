import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { getSocketForAccount, startAccount, getLatestQr } from "../whatsapp/baileys.js";
import QRCode from "qrcode";
import { syncGroups } from "../whatsapp/groups.js";
import { convertLink } from "../links/convert.js";
import { renderProductWithTemplate } from "../templates/service.js";
import { sendTextToGroups } from "../messages/send.js";
import { createScheduledMessage, cancelScheduledMessage } from "../scheduler/scheduled.js";
import { getAutoDispatchSettings, updateAutoDispatchSettings } from "../scheduler/autoDispatch.js";
import { extractProductDisplay } from "../templates/context.js";
import {
  getPlatformSettings,
  updatePlatformSettings,
  getMonitoringSettings,
  updateMonitoringSettings,
} from "../config/settings.js";
import {
  getMetaStatus,
  connectMeta,
  testMeta,
  disconnectMeta,
  runMetaSync,
} from "../integrations/metaService.js";

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
    return reply.code(202).send({ message: `Conta "${name}" sendo iniciada — o QR aparece em alguns segundos.` });
  });

  app.get<{ Params: { id: string } }>("/whatsapp/accounts/:id/qr", async (request) => {
    const raw = getLatestQr(request.params.id);
    if (!raw) return { qr: null };
    const qr = await QRCode.toDataURL(raw, { width: 280, margin: 1 });
    return { qr };
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

  app.get<{
    Querystring: {
      marketplace?: string;
      groupId?: string;
      status?: string;
      search?: string;
      favorite?: string;
      sort?: "recent" | "price_asc" | "price_desc" | "discount_desc";
    };
  }>("/products", async (request) => {
    const { marketplace, groupId, status, search, favorite, sort } = request.query;
    const products = await prisma.capturedProduct.findMany({
      where: {
        ...(marketplace ? { marketplace } : {}),
        ...(groupId ? { sourceGroupId: groupId } : {}),
        ...(status ? { status } : {}),
        ...(favorite === "true" ? { favorite: true } : {}),
        ...(search
          ? { messageText: { contains: search } }
          : {}),
      },
      orderBy: { capturedAt: "desc" },
      include: { sourceGroup: { select: { name: true } } },
    });

    const withDisplay = products.map((p) => ({ ...p, display: extractProductDisplay(p) }));

    switch (sort) {
      case "price_asc":
        withDisplay.sort((a, b) => a.display.priceDiscounted - b.display.priceDiscounted);
        break;
      case "price_desc":
        withDisplay.sort((a, b) => b.display.priceDiscounted - a.display.priceDiscounted);
        break;
      case "discount_desc":
        withDisplay.sort((a, b) => b.display.discountPercent - a.display.discountPercent);
        break;
      default:
        break; // ja vem por capturedAt desc
    }

    return withDisplay;
  });

  app.patch<{
    Params: { id: string };
    Body: {
      favorite?: boolean;
      nameOverride?: string | null;
      priceOriginalOverride?: string | null;
      priceDiscountedOverride?: string | null;
      couponOverride?: string | null;
    };
  }>("/products/:id", async (request, reply) => {
    const existing = await prisma.capturedProduct.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: "Produto não encontrado." });
    const updated = await prisma.capturedProduct.update({
      where: { id: request.params.id },
      data: request.body,
    });
    return { ...updated, display: extractProductDisplay(updated) };
  });

  app.post<{ Params: { id: string } }>("/products/:id/reconvert", async (request, reply) => {
    const existing = await prisma.capturedProduct.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: "Produto não encontrado." });

    let affiliateUrl: string | undefined;
    let conversionError: string | undefined;
    let status = existing.status;
    try {
      const result = await convertLink(existing.sourceUrl);
      affiliateUrl = result.affiliateUrl;
      status = result.method === "manual" ? "CAPTURED" : "CONVERTED";
    } catch (err) {
      conversionError = err instanceof Error ? err.message : "Erro desconhecido na conversão.";
      status = "CONVERSION_FAILED";
    }

    const updated = await prisma.capturedProduct.update({
      where: { id: existing.id },
      data: { affiliateUrl, conversionError: conversionError ?? null, status },
    });
    return { ...updated, display: extractProductDisplay(updated) };
  });

  app.delete<{ Params: { id: string } }>("/products/:id", async (request, reply) => {
    const existing = await prisma.capturedProduct.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: "Produto não encontrado." });
    await prisma.capturedProduct.delete({ where: { id: request.params.id } });
    return { ok: true };
  });

  // Aplica links de afiliado gerados manualmente no gerador oficial do ML
  // (fluxo em lote: usuario cola de volta os links que gerou logado na conta
  // dele). So aceita links do proprio ML - nao guardamos sessao/credencial,
  // o usuario gera os links por conta propria e cola aqui o resultado.
  function isMercadoLivreUrl(raw: string): boolean {
    try {
      const host = new URL(raw).hostname.replace(/^www\./, "");
      return host === "meli.la" || host.endsWith("mercadolivre.com.br");
    } catch {
      return false;
    }
  }

  app.post<{ Body: { items?: { id: string; affiliateUrl: string }[] } }>(
    "/products/set-links",
    async (request, reply) => {
      const items = request.body?.items ?? [];
      if (items.length === 0) return reply.code(400).send({ error: "Nenhum link enviado." });

      const results: { id: string; ok: boolean; error?: string }[] = [];
      for (const item of items) {
        const url = (item.affiliateUrl ?? "").trim();
        if (!url) {
          results.push({ id: item.id, ok: false, error: "Link vazio." });
          continue;
        }
        if (!isMercadoLivreUrl(url)) {
          results.push({ id: item.id, ok: false, error: "Link não é do Mercado Livre." });
          continue;
        }
        const existing = await prisma.capturedProduct.findUnique({ where: { id: item.id } });
        if (!existing) {
          results.push({ id: item.id, ok: false, error: "Produto não encontrado." });
          continue;
        }
        await prisma.capturedProduct.update({
          where: { id: item.id },
          data: { affiliateUrl: url, status: "CONVERTED", conversionError: null },
        });
        results.push({ id: item.id, ok: true });
      }
      return { results };
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

  // --- Configurações: Plataformas (credenciais de marketplace) ---

  app.get("/settings/platforms", async () => {
    return getPlatformSettings();
  });

  app.patch<{
    Body: {
      shopeeAppId?: string;
      shopeeAppSecret?: string;
      shopeeSubIds?: string;
      amazonAffiliateTag?: string;
      mercadoLivreTag?: string;
    };
  }>("/settings/platforms", async (request) => {
    return updatePlatformSettings(request.body);
  });

  // --- Configurações: Monitoramento automático + avançado ---

  app.get("/settings/monitoring", async () => {
    return getMonitoringSettings();
  });

  app.patch<{
    Body: { restrictedWords?: string; allowedWords?: string; dedupeWindowHours?: number };
  }>("/settings/monitoring", async (request) => {
    return updateMonitoringSettings(request.body);
  });

  // --- Financeiro (Fase 1: lançamento manual + resumo) ---

  const TIPOS = new Set(["gasto", "ganho"]);
  const PLATAFORMAS = new Set(["meta", "mercadolivre", "amazon", "shopee", "outro"]);
  const STATUSES = new Set(["pendente", "aprovado", "pago", "cancelado"]);

  type FinEntry = {
    id: string;
    tipo: string;
    plataforma: string;
    valorCents: number;
    moeda: string;
    status: string;
    dataEvento: Date;
    dataSincronizacao: Date | null;
    origem: string;
    referenciaExterna: string | null;
    descricao: string | null;
  };

  // Converte valorCents (Int no banco) pra reais (number) na resposta da API.
  function serializeEntry(e: FinEntry) {
    return { ...e, valor: e.valorCents / 100 };
  }

  // from/to sao "yyyy-mm-dd"; `to` vira fim do dia pra ser inclusivo.
  function dateRange(from?: string, to?: string) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(`${from}T00:00:00.000`);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(`${to}T23:59:59.999`);
      if (!isNaN(d.getTime())) range.lte = d;
    }
    return Object.keys(range).length ? range : undefined;
  }

  function parseValorCents(valor: unknown): number | null {
    const n = typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  app.get<{
    Querystring: { from?: string; to?: string; plataforma?: string; tipo?: string; status?: string };
  }>("/financeiro/entries", async (request) => {
    const { from, to, plataforma, tipo, status } = request.query;
    const entries = await prisma.financialEntry.findMany({
      where: {
        ...(plataforma ? { plataforma } : {}),
        ...(tipo ? { tipo } : {}),
        ...(status ? { status } : {}),
        ...(dateRange(from, to) ? { dataEvento: dateRange(from, to) } : {}),
      },
      orderBy: { dataEvento: "desc" },
    });
    return entries.map(serializeEntry);
  });

  app.get<{
    Querystring: { from?: string; to?: string; plataforma?: string };
  }>("/financeiro/summary", async (request) => {
    const { from, to, plataforma } = request.query;
    const range = dateRange(from, to);
    const baseWhere = {
      ...(plataforma ? { plataforma } : {}),
      ...(range ? { dataEvento: range } : {}),
    };

    const [gastos, aprovados, pendentes] = await Promise.all([
      prisma.financialEntry.aggregate({
        _sum: { valorCents: true },
        where: { ...baseWhere, tipo: "gasto", status: { not: "cancelado" } },
      }),
      prisma.financialEntry.aggregate({
        _sum: { valorCents: true },
        where: { ...baseWhere, tipo: "ganho", status: { in: ["aprovado", "pago"] } },
      }),
      prisma.financialEntry.aggregate({
        _sum: { valorCents: true },
        where: { ...baseWhere, tipo: "ganho", status: "pendente" },
      }),
    ]);

    const totalGastosCents = gastos._sum.valorCents ?? 0;
    const ganhosAprovadosCents = aprovados._sum.valorCents ?? 0;
    const ganhosPendentesCents = pendentes._sum.valorCents ?? 0;

    return {
      totalGastos: totalGastosCents / 100,
      ganhosAprovados: ganhosAprovadosCents / 100,
      ganhosPendentes: ganhosPendentesCents / 100,
      margem: (ganhosAprovadosCents - totalGastosCents) / 100,
    };
  });

  app.post<{
    Body: {
      tipo?: string;
      plataforma?: string;
      valor?: number | string;
      moeda?: string;
      status?: string;
      dataEvento?: string;
      referenciaExterna?: string | null;
      descricao?: string | null;
    };
  }>("/financeiro/entries", async (request, reply) => {
    const b = request.body ?? {};
    if (!b.tipo || !TIPOS.has(b.tipo)) return reply.code(400).send({ error: "tipo inválido." });
    if (!b.plataforma || !PLATAFORMAS.has(b.plataforma))
      return reply.code(400).send({ error: "plataforma inválida." });
    if (b.status && !STATUSES.has(b.status))
      return reply.code(400).send({ error: "status inválido." });
    const valorCents = parseValorCents(b.valor);
    if (valorCents === null) return reply.code(400).send({ error: "valor inválido." });
    const dataEvento = b.dataEvento ? new Date(b.dataEvento) : new Date();
    if (isNaN(dataEvento.getTime())) return reply.code(400).send({ error: "data inválida." });

    const created = await prisma.financialEntry.create({
      data: {
        tipo: b.tipo,
        plataforma: b.plataforma,
        valorCents,
        moeda: b.moeda || "BRL",
        status: b.status || (b.tipo === "gasto" ? "pago" : "pendente"),
        dataEvento,
        origem: "manual",
        referenciaExterna: b.referenciaExterna || null,
        descricao: b.descricao || null,
      },
    });
    return serializeEntry(created);
  });

  app.patch<{
    Params: { id: string };
    Body: {
      tipo?: string;
      plataforma?: string;
      valor?: number | string;
      moeda?: string;
      status?: string;
      dataEvento?: string;
      referenciaExterna?: string | null;
      descricao?: string | null;
    };
  }>("/financeiro/entries/:id", async (request, reply) => {
    const existing = await prisma.financialEntry.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: "Lançamento não encontrado." });
    const b = request.body ?? {};
    if (b.tipo && !TIPOS.has(b.tipo)) return reply.code(400).send({ error: "tipo inválido." });
    if (b.plataforma && !PLATAFORMAS.has(b.plataforma))
      return reply.code(400).send({ error: "plataforma inválida." });
    if (b.status && !STATUSES.has(b.status))
      return reply.code(400).send({ error: "status inválido." });

    const data: Record<string, unknown> = {};
    if (b.tipo) data.tipo = b.tipo;
    if (b.plataforma) data.plataforma = b.plataforma;
    if (b.moeda) data.moeda = b.moeda;
    if (b.status) data.status = b.status;
    if (b.referenciaExterna !== undefined) data.referenciaExterna = b.referenciaExterna || null;
    if (b.descricao !== undefined) data.descricao = b.descricao || null;
    if (b.valor !== undefined) {
      const valorCents = parseValorCents(b.valor);
      if (valorCents === null) return reply.code(400).send({ error: "valor inválido." });
      data.valorCents = valorCents;
    }
    if (b.dataEvento) {
      const d = new Date(b.dataEvento);
      if (isNaN(d.getTime())) return reply.code(400).send({ error: "data inválida." });
      data.dataEvento = d;
    }

    const updated = await prisma.financialEntry.update({ where: { id: existing.id }, data });
    return serializeEntry(updated);
  });

  app.delete<{ Params: { id: string } }>("/financeiro/entries/:id", async (request, reply) => {
    const existing = await prisma.financialEntry.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: "Lançamento não encontrado." });
    await prisma.financialEntry.delete({ where: { id: existing.id } });
    return { ok: true };
  });

  // --- Integrações: Meta Ads (Fase 2) ---

  app.get("/integrations/meta", async () => {
    return getMetaStatus();
  });

  app.post<{
    Body: {
      appId?: string;
      accessToken?: string;
      adAccountId?: string;
      syncEnabled?: boolean;
      syncIntervalMinutes?: number;
      lookbackDays?: number;
    };
  }>("/integrations/meta", async (request, reply) => {
    try {
      return await connectMeta(request.body ?? {});
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Erro ao conectar na Meta." });
    }
  });

  app.post("/integrations/meta/test", async (_request, reply) => {
    try {
      return await testMeta();
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Falha ao testar conexão." });
    }
  });

  app.post("/integrations/meta/sync", async (_request, reply) => {
    try {
      return await runMetaSync();
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Falha ao sincronizar." });
    }
  });

  app.delete("/integrations/meta", async () => {
    return disconnectMeta();
  });
}
