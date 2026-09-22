import { env } from "../config/env.js";

/**
 * Palavras restritas descartam a mensagem sempre que presentes.
 * Palavras permitidas, quando configuradas, exigem que ao menos uma apareça
 * (filtro positivo mais restritivo) — mesma semântica do BuboFlow original.
 */
export function passesKeywordFilter(text: string): boolean {
  const lower = text.toLowerCase();

  if (env.monitoring.restrictedWords.some((word) => lower.includes(word))) {
    return false;
  }

  if (env.monitoring.allowedWords.length > 0) {
    return env.monitoring.allowedWords.some((word) => lower.includes(word));
  }

  return true;
}
