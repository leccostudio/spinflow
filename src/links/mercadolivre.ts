/**
 * Mercado Livre has no simple public affiliate API for individual creators.
 * V1: passthrough — the user converts manually via the ML affiliate portal
 * and pastes the resulting link. Automating this (browser-extension-assisted
 * token capture) is a later, higher-effort item — see project README.
 */
export function convertMercadoLivreLink(originUrl: string): { url: string; manual: true } {
  return { url: originUrl, manual: true };
}
