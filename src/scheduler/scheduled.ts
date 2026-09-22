import { prisma } from "../db/client.js";
import { renderProductWithTemplate } from "../templates/service.js";
import { sendTextToGroups } from "../messages/send.js";

const CHECK_INTERVAL_MS = 30_000;

export async function createScheduledMessage(input: {
  groupIds: string[];
  scheduledAt: Date;
  text?: string;
  productId?: string;
  templateId?: string;
}) {
  if (!input.text && !input.productId) {
    throw new Error("Forneça 'text' ou 'productId' para o agendamento.");
  }

  return prisma.scheduledMessage.create({
    data: {
      groupIds: input.groupIds.join(","),
      text: input.text,
      productId: input.productId,
      templateId: input.templateId,
      scheduledAt: input.scheduledAt,
      status: "PENDING",
    },
  });
}

export async function cancelScheduledMessage(id: string) {
  const existing = await prisma.scheduledMessage.findUnique({ where: { id } });
  if (!existing) throw new Error("Agendamento não encontrado.");
  if (existing.status !== "PENDING") throw new Error("Só é possível cancelar agendamentos pendentes.");

  return prisma.scheduledMessage.update({ where: { id }, data: { status: "CANCELLED" } });
}

async function processDueScheduledMessages(): Promise<void> {
  const due = await prisma.scheduledMessage.findMany({
    where: { status: "PENDING", scheduledAt: { lte: new Date() } },
  });

  for (const job of due) {
    const groupIds = job.groupIds.split(",").filter(Boolean);

    try {
      let text = job.text ?? undefined;
      let previewUrl: string | undefined;
      let imagePath: string | null | undefined;

      if (!text && job.productId) {
        const rendered = await renderProductWithTemplate(job.productId, job.templateId ?? undefined);
        text = rendered.text;
        const product = await prisma.capturedProduct.findUnique({ where: { id: job.productId } });
        previewUrl = product?.affiliateUrl ?? product?.sourceUrl;
        imagePath = product?.imagePath;
      }

      if (!text) throw new Error("Agendamento sem texto e sem produto associado.");

      await sendTextToGroups(groupIds, text, { previewUrl, imagePath });

      await prisma.scheduledMessage.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      console.log(`[agendamento] Enviado: ${job.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      await prisma.scheduledMessage.update({
        where: { id: job.id },
        data: { status: "FAILED", error: message },
      });
      console.error(`[agendamento] Falhou (${job.id}):`, message);
    }
  }
}

export function startScheduledMessageLoop(): NodeJS.Timeout {
  return setInterval(() => {
    processDueScheduledMessages().catch((err) =>
      console.error("[agendamento] Erro no loop de verificação:", err)
    );
  }, CHECK_INTERVAL_MS);
}
