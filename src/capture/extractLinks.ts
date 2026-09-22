const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

export function extractLinks(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  // Trim common trailing punctuation left over from sentence text.
  return matches.map((url) => url.replace(/[.,;!?)\]]+$/, ""));
}
