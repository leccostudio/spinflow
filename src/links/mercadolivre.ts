import { getPlatformSettings, isMercadoLivreConfigured } from "../config/settings.js";

/**
 * Mercado Livre nao tem API publica de afiliados, mas o rastreio de comissao
 * usa dois query params estaveis e reutilizaveis: matt_word (tag) e
 * matt_tool (codigo numerico do cadastro de afiliado) — confirmado inspecionando
 * um link real gerado no portal oficial (não documentado publicamente, mas
 * verificado, não é suposição).
 *
 * Links capturados de grupos monitorados as vezes vem como short link
 * (meli.la/...) com o matt_word/matt_tool de QUEM POSTOU embutido no redirect
 * — por isso resolvemos SO esse caso e substituímos pelos nossos próprios
 * parâmetros, senão a comissão iria pro afiliado original, não pra gente.
 *
 * IMPORTANTE: NÃO tentamos resolver/buscar uma URL que já é uma página
 * completa do produto (produto.mercadolivre.com.br/...) — fazer fetch nela
 * direto dispara a verificação anti-bot do ML (/gz/account-verification),
 * que vira erroneamente o "link convertido" se não filtrarmos isso. Bug real
 * encontrado em produção: só resolvemos hosts de link curto conhecidos.
 */
// IMPORTANTE #2: quando o short link resolve para "mercadolivre.com.br/social/{usuario}?...&ref=<token>",
// o param `ref` NAO e identidade de afiliado - e um token opaco que diz a SPA do ML qual produto
// especifico exibir naquela pagina de perfil social. Apagar `ref` (bug real encontrado em producao)
// faz a pagina cair na aba generica "Listas" do perfil de quem postou, em vez do produto: o link
// "convertido" parecia certo (matt_word/matt_tool corretos) mas levava para o lugar errado.
// Confirmado ao vivo: preservando ref/forceInApp e so trocando matt_word/matt_tool, a pagina mostra
// o produto certo. So removemos e substituimos matt_word/matt_tool - unicos params de comissao.
const SHORT_LINK_HOSTS = new Set(["meli.la"]);
const BOT_CHECK_MARKERS = ["/gz/account-verification", "/security/"];

function isShortLink(url: URL): boolean {
  return SHORT_LINK_HOSTS.has(url.hostname) || url.pathname.startsWith("/sec/");
}

async function resolveShortLink(originUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Sem User-Agent de navegador, o ML bloqueia com 403 (confirmado testando).
    const response = await fetch(originUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);
    if (response.ok && !BOT_CHECK_MARKERS.some((marker) => response.url.includes(marker))) {
      return response.url || originUrl;
    }
  } catch {
    // segue com a URL original
  }
  return originUrl;
}

export async function convertMercadoLivreLink(originUrl: string): Promise<string> {
  if (!(await isMercadoLivreConfigured())) {
    throw new Error(
      "Tag/Código do Mercado Livre não configurados (Configurações > Plataformas)."
    );
  }

  const settings = await getPlatformSettings();
  const parsedOrigin = new URL(originUrl);

  // So faz o fetch de resolve pra link curto de verdade — uma URL de produto
  // completa ja e o destino final, buscar ela so arrisca cair no anti-bot.
  const resolvedUrl = isShortLink(parsedOrigin) ? await resolveShortLink(originUrl) : originUrl;

  const url = new URL(resolvedUrl);
  // So mexemos nos params de identidade de afiliado/comissao. NAO tocamos em
  // `ref`/`forceInApp` (nem em nenhum outro param) - eles controlam qual
  // produto a pagina exibe, ver comentario acima.
  url.searchParams.delete("matt_word");
  url.searchParams.delete("matt_tool");
  url.searchParams.set("matt_word", settings.mercadoLivreTag);
  url.searchParams.set("matt_tool", settings.mercadoLivreCode);

  return url.toString();
}
