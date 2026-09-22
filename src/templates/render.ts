import Handlebars from "handlebars";
import type { TemplateContext } from "./context.js";

// noEscape: estamos gerando texto pra WhatsApp, nao HTML.
const handlebars = Handlebars.create();
handlebars.registerHelper("ifGt", function (this: unknown, a: number, b: number, options) {
  return a > b ? options.fn(this) : options.inverse(this);
});

const compiledCache = new Map<string, HandlebarsTemplateDelegate>();

export function renderTemplate(content: string, context: TemplateContext): string {
  let compiled = compiledCache.get(content);
  if (!compiled) {
    compiled = handlebars.compile(content, { noEscape: true, strict: false });
    compiledCache.set(content, compiled);
  }
  return compiled(context).trim();
}
