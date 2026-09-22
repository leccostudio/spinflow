# SpinFlow

Sistema próprio de automação de ofertas para grupos de WhatsApp — uso pessoal, single-tenant, inspirado no mapeamento funcional do BuboFlow.

## Stack

- Node.js + TypeScript + Fastify
- Prisma + SQLite (banco em arquivo, `data/spinflow.db`)
- Baileys (conexão não-oficial com WhatsApp)

## Setup

```bash
npm install
npx prisma migrate dev
npm run dev
```

Na primeira execução, um QR code aparece no terminal. Escaneie em **WhatsApp > Aparelhos conectados > Conectar aparelho**. A sessão fica salva em `data/auth/` (não versionar — já está no `.gitignore`; equivale a estar logado na sua conta).

## Estado atual

- [x] **Sprint 1** — Servidor Fastify + Prisma/SQLite, conexão WhatsApp via Baileys (QR pairing, reconexão automática), sincronização e toggle de grupos
- [x] **Sprint 2** — Conversão de link: Shopee (API oficial, assinatura SHA256), Amazon (tag na URL), Mercado Livre (manual)
- [x] **Sprint 3** — Captura de produtos: listener nos grupos monitorados, filtro de marketplace *por grupo*, palavras restritas/permitidas (globais), deduplicação por janela de horas
- [x] **Sprint 4** — Motor de templates (Handlebars) + envio manual, com extração heurística de nome/preço/desconto/cupom do texto bruto capturado

## Configuração (`.env`)

| Variável | Uso |
|---|---|
| `SHOPEE_APP_ID` / `SHOPEE_APP_SECRET` | Credenciais da API de afiliados Shopee |
| `SHOPEE_SUB_IDS` | Até 5 sub-ids de rastreio, separados por vírgula |
| `AMAZON_AFFILIATE_TAG` | Tag de associado Amazon |
| `MERCADOLIVRE_TAG` | Reservado (conversão ML ainda é manual) |
| `RESTRICTED_WORDS` | Palavras que descartam a captura, separadas por vírgula |
| `ALLOWED_WORDS` | Se preenchido, só captura mensagens com pelo menos uma dessas palavras |
| `DEDUPE_WINDOW_HOURS` | Janela de horas pra evitar capturar o mesmo produto de novo (padrão 12; `0` desativa) |

## Endpoints disponíveis

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Healthcheck |
| GET | `/whatsapp/status` | Status da conexão WhatsApp |
| GET | `/whatsapp/groups` | Lista grupos sincronizados |
| POST | `/whatsapp/groups/sync` | Força sincronização da lista de grupos do WhatsApp conectado |
| PATCH | `/whatsapp/groups/:id` | Atualiza `isMonitoring` / `isSending` / `monitoredMarketplaces` de um grupo |
| POST | `/links/convert` | Converte um link (`{ url, subIds? }`) pro marketplace detectado |
| GET | `/products` | Lista produtos capturados (filtros: `?marketplace=`, `?groupId=`, `?status=`) |
| GET/POST | `/templates` | Lista / cria templates de mensagem |
| PATCH/DELETE | `/templates/:id` | Atualiza / remove um template |
| POST | `/templates/:id/preview` | Renderiza um template contra um produto (`{ productId }`), sem enviar |
| POST | `/messages/send` | Envia mensagem pros grupos (`{ groupIds, text }` ou `{ groupIds, productId, templateId? }`) |

## Sintaxe de template

Variáveis: `{{nome_do_produto}}`, `{{preco_original}}`, `{{preco_com_desconto}}`, `{{percentual_desconto}}`, `{{cupom}}`, `{{link_produto}}`, `{{informacao_adicional}}`.

Condicionais (Handlebars — sintaxe diferente do BuboFlow original, mais fácil de escrever/ler):

```
{{#ifGt percentual_desconto 0}}De: ~R$ {{preco_original}}~
{{/ifGt}}*Por: R$ {{preco_com_desconto}}*

{{#if cupom}}Cupom: {{cupom}}
{{/if}}
```

## Próximos passos (roadmap enxuto)

1. ~~Conversão de link~~ ✅
2. ~~Captura de produtos nos grupos monitorados + filtros~~ ✅
3. ~~Motor de templates + envio manual~~ ✅
4. Agendamento + disparo automático (com guardrails anti-ban)
5. Bot do Grupo de Automação (comandos via WhatsApp)
