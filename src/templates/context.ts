import type { CapturedProduct } from "@prisma/client";

export interface TemplateContext {
  nome_do_produto: string;
  preco_original: string;
  preco_com_desconto: string;
  percentual_desconto: number;
  cupom: string;
  link_produto: string;
  informacao_adicional: string;
}

const PRICE_RANGE_REGEX = /de\s+r\$\s?([\d.,]+)\s+por\s+r\$\s?([\d.,]+)/i;
const SINGLE_PRICE_REGEX = /r\$\s?([\d.,]+)/i;
const COUPON_REGEX = /cupom:?\s*\*?([a-z0-9]{4,20})\*?/i;

function toNumber(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function extractProductName(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  return firstLine.replace(/\*/g, "").trim();
}

/**
 * Heuristica sobre o texto bruto capturado do grupo (nao temos API de dados
 * de produto configurada por padrao) — funciona bem no formato comum de
 * mensagem de oferta: "Nome\n\nDe R$ X por R$ Y\n\nCupom: Z\n\nLink: ...".
 */
export function extractProductInfo(product: CapturedProduct): TemplateContext {
  const text = product.messageText ?? "";

  const rangeMatch = text.match(PRICE_RANGE_REGEX);
  let originalPrice: number;
  let discountedPrice: number;

  if (rangeMatch) {
    originalPrice = toNumber(rangeMatch[1]);
    discountedPrice = toNumber(rangeMatch[2]);
  } else {
    const singleMatch = text.match(SINGLE_PRICE_REGEX);
    discountedPrice = singleMatch ? toNumber(singleMatch[1]) : 0;
    originalPrice = discountedPrice;
  }

  const discountPercent =
    originalPrice > discountedPrice && originalPrice > 0
      ? Math.round(100 - (discountedPrice / originalPrice) * 100)
      : 0;

  const couponMatch = text.match(COUPON_REGEX);

  return {
    nome_do_produto: extractProductName(text) || "Produto",
    preco_original: originalPrice.toFixed(2).replace(".", ","),
    preco_com_desconto: discountedPrice.toFixed(2).replace(".", ","),
    percentual_desconto: discountPercent,
    cupom: couponMatch?.[1] ?? "",
    link_produto: product.affiliateUrl ?? product.sourceUrl,
    informacao_adicional: "",
  };
}
