import { getRestrictedWords, getAllowedWords } from "../config/settings.js";

/**
 * Palavras restritas descartam a mensagem sempre que presentes.
 * Palavras permitidas, quando configuradas, exigem que ao menos uma apareça
 * (filtro positivo mais restritivo) — mesma semântica do BuboFlow original.
 */
export async function passesKeywordFilter(text: string): Promise<boolean> {
  const lower = text.toLowerCase();

  const restrictedWords = await getRestrictedWords();
  if (restrictedWords.some((word) => lower.includes(word))) {
    return false;
  }

  const allowedWords = await getAllowedWords();
  if (allowedWords.length > 0) {
    return allowedWords.some((word) => lower.includes(word));
  }

  return true;
}
