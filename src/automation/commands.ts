export type ParsedCommand =
  | { type: "dispatch"; link: string }
  | { type: "preview"; link: string }
  | { type: "convert"; link: string }
  | { type: "video"; link: string }
  | { type: "save"; link: string; priority: boolean }
  | { type: "broadcast"; text: string }
  | { type: "toggleAutoDispatch"; enabled: boolean }
  | { type: "unknown" };

const URL_REGEX = /^https?:\/\//i;
// A ordem importa: "salvar_prioridade" precisa vir antes de "salvar" na alternativa.
const PREFIXED_REGEX = /^(preview|converter|video|salvar_prioridade|salvar|envio):\s*(.+)$/is;

export function parseCommand(rawText: string): ParsedCommand {
  const text = rawText.trim();

  if (/^envio_automatico_on$/i.test(text)) return { type: "toggleAutoDispatch", enabled: true };
  if (/^envio_automatico_off$/i.test(text)) return { type: "toggleAutoDispatch", enabled: false };

  const prefixed = text.match(PREFIXED_REGEX);
  if (prefixed) {
    const [, cmd, rest] = prefixed;
    const value = rest.trim();
    switch (cmd.toLowerCase()) {
      case "preview":
        return { type: "preview", link: value };
      case "converter":
        return { type: "convert", link: value };
      case "video":
        return { type: "video", link: value };
      case "salvar_prioridade":
        return { type: "save", link: value, priority: true };
      case "salvar":
        return { type: "save", link: value, priority: false };
      case "envio":
        return { type: "broadcast", text: value };
    }
  }

  if (URL_REGEX.test(text)) {
    return { type: "dispatch", link: text };
  }

  return { type: "unknown" };
}
