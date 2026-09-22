import { prisma } from "../db/client.js";

const SEED_TEMPLATE_ID = "seed-default-template";

const DEFAULT_TEMPLATE = `*{{nome_do_produto}}*

{{#ifGt percentual_desconto 0}}De: ~R$ {{preco_original}}~
{{/ifGt}}*Por: R$ {{preco_com_desconto}}* 🔥

{{#if cupom}}🎟 Cupom: *{{cupom}}*
{{/if}}
Link: {{link_produto}}`;

/**
 * upsert com ID fixo em vez de "count() -> create()": esse ultimo tem uma
 * race condition (dois restarts do watch mode disparando quase juntos criam
 * dois registros) que ja aconteceu aqui.
 */
export async function seedDefaultTemplate(): Promise<void> {
  const anyTemplateExists = (await prisma.messageTemplate.count()) > 0;
  if (anyTemplateExists) return;

  await prisma.messageTemplate.upsert({
    where: { id: SEED_TEMPLATE_ID },
    update: {},
    create: {
      id: SEED_TEMPLATE_ID,
      name: "Padrão",
      marketplace: "",
      content: DEFAULT_TEMPLATE,
      isActive: true,
    },
  });
  console.log('Template padrão garantido ("Padrão").');
}
