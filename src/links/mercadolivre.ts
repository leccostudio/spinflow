import { getPlatformSettings, isMercadoLivreConfigured } from "../config/settings.js";

/**
 * Mercado Livre nao tem API publica de afiliados, mas o rastreio de comissao
 * usa dois query params estaveis e reutilizaveis: matt_word (tag) e
 * matt_tool (codigo numerico do cadastro de afiliado) — confirmado inspecionando
 * um link real gerado no portal oficial (não documentado publicamente, mas
 * verificado, não é suposição).
 *
 * Links capturados de grupos monitorados costumam vir como short link
 * (meli.la/... ou .../social/...) com o matt_word/matt_tool de QUEM POSTOU
 * embutido no redirect — por isso resolvemos o link primeiro e substituímos
 * pelos nossos próprios parâmetros, senão a comissão iria pro afiliado
 * original, não pra gente.
 */
export async function convertMercadoLivreLink(originUrl: string): Promise<string> {
  if (!(await isMercadoLivreConfigured())) {
    throw new Error(
      "Tag/Código do Mercado Livre não configurados (Configurações > Plataformas)."
    );
  }

  const settings = await getPlatformSettings();

  let resolvedUrl = originUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Sem User-Agent de navegador, o ML bloqueia com 403 (confirmado testando) —
    // o link nao resolve e a comissao ficaria com quem postou o link original.
    const response = await fetch(originUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);
    if (response.ok) {
      resolvedUrl = response.url || originUrl;
    }
  } catch {
    // Se o resolve falhar, segue com a URL original — pelo menos tenta.
  }

  const url = new URL(resolvedUrl);
  url.searchParams.delete("matt_word");
  url.searchParams.delete("matt_tool");
  url.searchParams.delete("ref");
  url.searchParams.delete("forceInApp");
  url.searchParams.set("matt_word", settings.mercadoLivreTag);
  url.searchParams.set("matt_tool", settings.mercadoLivreCode);

  return url.toString();
}
