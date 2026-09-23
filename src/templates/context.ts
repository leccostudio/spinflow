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

export interface ProductDisplay {
  name: string;
  priceOriginal: number;
  priceDiscounted: number;
  discountPercent: number;
  coupon: string;
}

const PRICE_RANGE_REGEX = /de\s+r\$\s?([\d.,]+)\s+por\s+r\$\s?([\d.,]+)/i;
const SINGLE_PRICE_REGEX = /r\$\s?([\d.,]+)/i;
const COUPON_REGEX = /cupom:?\s*\*?([a-z0-9]{4,20})\*?/i;

function toNumber(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function parsePrice(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function extractProductName(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  return firstLine.replace(/\*/g, "").trim();
}

/**
 * Heuristica sobre o texto bruto capturado do grupo (nao temos API de dados
 * de produto configurada por padrao) — funciona bem no formato comum de
 * mensagem de oferta: "Nome\n\nDe R$ X por R$ Y\n\nCupom: Z\n\nLink: ...".
 * Overrides manuais (tela "Editar produto") tem prioridade quando preenchidos.
 */
export function extractProductDisplay(product: CapturedProduct): ProductDisplay {
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

  originalPrice = parsePrice(product.priceOriginalOverride) ?? originalPrice;
  discountedPrice = parsePrice(product.priceDiscountedOverride) ?? discountedPrice;

  const discountPercent =
    originalPrice > discountedPrice && originalPrice > 0
      ? Math.round(100 - (discountedPrice / originalPrice) * 100)
      : 0;

  const couponMatch = text.match(COUPON_REGEX);

  return {
    name: product.nameOverride || extractProductName(text) || "Produto",
    priceOriginal: originalPrice,
    priceDiscounted: discountedPrice,
    discountPercent,
    coupon: product.couponOverride || couponMatch?.[1] || "",
  };
}

export function extractProductInfo(product: CapturedProduct): TemplateContext {
  const display = extractProductDisplay(product);
  return {
    nome_do_produto: display.name,
    preco_original: display.priceOriginal.toFixed(2).replace(".", ","),
    preco_com_desconto: display.priceDiscounted.toFixed(2).replace(".", ","),
    percentual_desconto: display.discountPercent,
    cupom: display.coupon,
    link_produto: product.affiliateUrl ?? product.sourceUrl,
    informacao_adicional: "",
  };
}
