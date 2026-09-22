import { prisma } from "../db/client.js";
import { extractProductInfo } from "./context.js";
import { renderTemplate } from "./render.js";

export async function pickTemplateForMarketplace(marketplace: string) {
  return (
    (await prisma.messageTemplate.findFirst({
      where: { isActive: true, marketplace },
    })) ??
    (await prisma.messageTemplate.findFirst({
      where: { isActive: true, marketplace: "" },
    }))
  );
}

export async function renderProductWithTemplate(
  productId: string,
  templateId?: string
): Promise<{ text: string; templateId: string; templateName: string }> {
  const product = await prisma.capturedProduct.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Produto não encontrado.");

  const template = templateId
    ? await prisma.messageTemplate.findUnique({ where: { id: templateId } })
    : await pickTemplateForMarketplace(product.marketplace);

  if (!template) {
    throw new Error(
      `Nenhum template ativo encontrado para "${product.marketplace}" (e nenhum template genérico como fallback).`
    );
  }

  const context = extractProductInfo(product);
  const text = renderTemplate(template.content, context);

  return { text, templateId: template.id, templateName: template.name };
}
