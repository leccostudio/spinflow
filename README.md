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

**Importante ao reiniciar o dev server**: sempre pare o processo anterior antes de subir um novo (`npm run dev` em cima de outro já rodando causa dois processos escutando a mesma sessão do WhatsApp e comportamento inconsistente — isso já aconteceu uma vez nesta sessão de desenvolvimento).

## Estado atual — MVP completo

- [x] **Sprint 1** — Servidor Fastify + Prisma/SQLite, conexão WhatsApp via Baileys (QR pairing, reconexão automática), sincronização e toggle de grupos
- [x] **Sprint 2** — Conversão de link: Shopee (API oficial, assinatura SHA256), Amazon (tag na URL), Mercado Livre (manual)
- [x] **Sprint 3** — Captura de produtos: listener nos grupos monitorados, filtro de marketplace *por grupo*, palavras restritas/permitidas (globais), deduplicação por janela de horas
- [x] **Sprint 4** — Motor de templates (Handlebars) + envio manual, com extração heurística de nome/preço/desconto/cupom do texto bruto capturado
- [x] **Imagem original** — reaproveita a foto da mensagem capturada (`useOriginalImage` por grupo) em vez de depender de link preview
- [x] **Sprint 5** — Agendamento (fila própria, checada a cada 30s) + disparo automático com guardrails anti-ban
- [x] **Sprint 6** — Bot "Grupo de Automação": comandos via WhatsApp (link cru, `preview:`, `converter:`, `salvar:`, `salvar_prioridade:`, `envio:`, `envio_automatico_on/off`)

## ⚠️ Antes de ativar disparo automático ou o bot de comandos

As duas funcionalidades abaixo **enviam mensagens de verdade pros seus grupos reais** (o #07 tem 264 pessoas) sem supervisão manual a cada envio. Por isso, **ficam desligadas por padrão**:

- **Disparo automático**: `AutoDispatchSettings.enabled = false` até você ativar via `PATCH /auto-dispatch { "enabled": true }` (ou o comando `envio_automatico_on` depois que o bot estiver configurado).
- **Bot do Grupo de Automação**: nenhum grupo tem `isAutomationGroup = true` por padrão. Ele só reage a mensagens no grupo que você designar via `PATCH /whatsapp/groups/:id { "isAutomationGroup": true }`. Sem isso configurado, o listener existe mas não tem onde escutar — inerte por construção.

**Recomendação**: na primeira vez que for ativar cada um, fique de olho no grupo #08 (só 2 participantes) antes de confiar no #07 com a audiência real.

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
| PATCH | `/whatsapp/groups/:id` | Atualiza `isMonitoring` / `isSending` / `monitoredMarketplaces` / `useOriginalImage` / `isAutomationGroup` |
| POST | `/links/convert` | Converte um link (`{ url, subIds? }`) pro marketplace detectado |
| GET | `/products` | Lista produtos capturados (filtros: `?marketplace=`, `?groupId=`, `?status=`) |
| GET/POST | `/templates` | Lista / cria templates de mensagem |
| PATCH/DELETE | `/templates/:id` | Atualiza / remove um template |
| POST | `/templates/:id/preview` | Renderiza um template contra um produto (`{ productId }`), sem enviar |
| POST | `/messages/send` | Envia mensagem pros grupos agora (`{ groupIds, text }` ou `{ groupIds, productId, templateId? }`) |
| GET/POST | `/messages/scheduled` | Lista / cria agendamento (`{ groupIds, scheduledAt (ISO), text }` ou `productId`) |
| DELETE | `/messages/scheduled/:id` | Cancela um agendamento pendente |
| GET/PATCH | `/auto-dispatch` | Lê / atualiza config do disparo automático (guardrails aplicados no PATCH) |

## Guardrails do disparo automático

Baseado nos presets reais de mercado mapeados do BuboFlow. Valores rejeitados automaticamente:

- Intervalo mínimo entre envios **não pode ser menor que 5 minutos**.
- Máximo de produtos por execução **não pode passar de 5**.
- Defaults seguros: 30–60 min de intervalo, 1–2 produtos por execução, janela 09h–22h.

## Bot "Grupo de Automação" — comandos

| Comando | Efeito |
|---|---|
| `(link cru)` | Converte e dispara pra todos os grupos de envio agora |
| `preview: <link>` | Salva no catálogo e responde com o preview renderizado, sem disparar |
| `converter: <link>` | Responde só com o link de afiliado convertido |
| `salvar: <link>` | Salva no catálogo (entra na fila do disparo automático) |
| `salvar_prioridade: <link>` | Salva com prioridade (fura a fila do disparo automático) |
| `envio: <texto>` | Manda um comunicado de texto simples pra todos os grupos de envio |
| `envio_automatico_on` / `_off` | Liga/desliga o disparo automático |
| `video: <link>` | Não implementado neste MVP — responde avisando |

## Sintaxe de template

Variáveis: `{{nome_do_produto}}`, `{{preco_original}}`, `{{preco_com_desconto}}`, `{{percentual_desconto}}`, `{{cupom}}`, `{{link_produto}}`, `{{informacao_adicional}}`.

Condicionais (Handlebars — sintaxe diferente do BuboFlow original, mais fácil de escrever/ler):

```
{{#ifGt percentual_desconto 0}}De: ~R$ {{preco_original}}~
{{/ifGt}}*Por: R$ {{preco_com_desconto}}*

{{#if cupom}}Cupom: {{cupom}}
{{/if}}
```

## Limitações conhecidas / próximos passos possíveis

- **Mercado Livre**: conversão de link ainda é manual (sem API pública simples — o original usa uma extensão de navegador pra capturar token, não implementada aqui).
- **Preço/nome de produto**: extraídos por heurística de regex sobre o texto capturado, não por API oficial de dados de produto — funciona bem no formato comum ("Nome\n\nDe R$X por R$Y\n\nCupom: Z"), mas não é 100% garantido.
- **`preview:` do bot**: como não temos API de dados de produto, o preview reflete só o que dá pra extrair do próprio link — sem contexto de mensagem (nome/preço), o resultado fica genérico.
- Relatórios (envios, monitor de membros) e reescrita de CTA via IA não foram implementados — item "fase 7" do roadmap original, não essencial pro funcionamento.
