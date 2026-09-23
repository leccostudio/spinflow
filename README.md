# SpinFlow

Sistema próprio de automação de ofertas para grupos de WhatsApp — uso pessoal, single-tenant, inspirado no mapeamento funcional do BuboFlow.

## Stack

- Node.js + TypeScript + Fastify (API em `/api`)
- React + Vite + TypeScript (painel web, servido pelo próprio Fastify em produção)
- Prisma + SQLite (banco em arquivo, `data/spinflow.db`)
- Baileys (conexão não-oficial com WhatsApp)

## Setup local

```bash
npm install
npx prisma migrate dev
npm run build:web   # builda o painel (web/dist) - so precisa refazer quando mexer no frontend
npm run dev
```

Acesse `http://localhost:3333` — vai pedir a senha definida em `AUTH_PASSWORD` no `.env`.

Na primeira execução, um QR code aparece no terminal. Escaneie em **WhatsApp > Aparelhos conectados > Conectar aparelho**. A sessão fica salva em `data/auth/` (não versionar — já está no `.gitignore`; equivale a estar logado na sua conta).

**Importante ao reiniciar o dev server**: sempre pare o processo anterior antes de subir um novo (`npm run dev` em cima de outro já rodando causa dois processos escutando a mesma sessão do WhatsApp e comportamento inconsistente — isso já aconteceu nesta sessão de desenvolvimento).

## Deploy em servidor (VPS)

Ver [DEPLOY.md](DEPLOY.md) — Dockerfile e docker-compose já prontos, guia passo a passo do que falta fazer no provedor de VPS (isso só você pode fazer, exige conta/pagamento).

## Estado atual — MVP completo + operação

- [x] **Sprint 1** — Servidor Fastify + Prisma/SQLite, conexão WhatsApp via Baileys (QR pairing, reconexão automática), sincronização e toggle de grupos
- [x] **Sprint 2** — Conversão de link: Shopee (API oficial, assinatura SHA256), Amazon (tag na URL), Mercado Livre (manual)
- [x] **Sprint 3** — Captura de produtos: listener nos grupos monitorados, filtro de marketplace *por grupo*, palavras restritas/permitidas (globais), deduplicação por janela de horas
- [x] **Sprint 4** — Motor de templates (Handlebars) + envio manual, com extração heurística de nome/preço/desconto/cupom do texto bruto capturado
- [x] **Imagem original** — reaproveita a foto da mensagem capturada (`useOriginalImage` por grupo) em vez de depender de link preview
- [x] **Sprint 5** — Agendamento (fila própria, checada a cada 30s) + disparo automático com guardrails anti-ban
- [x] **Sprint 6** — Bot "Grupo de Automação": comandos via WhatsApp (link cru, `preview:`, `converter:`, `salvar:`, `salvar_prioridade:`, `envio:`, `envio_automatico_on/off`)
- [x] **Painel web** — React/Vite, todas as telas (Visão Geral, Contas, Grupos, Produtos, Templates, Agendamentos, Disparo Automático)
- [x] **Autenticação** — senha + sessão em cookie httpOnly, toda a API protegida
- [x] **Deploy** — Dockerfile + docker-compose, guia de VPS
- [x] **Múltiplas contas WhatsApp / failover por grupo** — gerenciador multi-conta, conta de backup configurável por grupo (precisa de um segundo chip físico pra escanear — código pronto, falta você conectar o número), QR code direto no painel
- [x] **Hub de Configurações** — Disparo Automático, Grupo de Automação, Plataformas, Monitoramento Automático, Configurações Avançadas, Templates (link), Site (não implementado, com aviso explícito)
- [x] **Credenciais e filtros configuráveis pela UI** — Shopee/Amazon/ML, palavras restritas/permitidas e janela de dedupe saíram do `.env` e foram pro banco, editáveis sem reiniciar o servidor
- [x] **Produtos redesenhado** — grade de cards, filtro por plataforma/ordenação/status, busca por nome, favoritar, excluir, e **editar** (corrige nome/preço/cupom quando a extração automática erra)

## ⚠️ Antes de ativar disparo automático ou o bot de comandos

As duas funcionalidades abaixo **enviam mensagens de verdade pros seus grupos reais** (o #07 tem 266+ pessoas) sem supervisão manual a cada envio. Por isso, **ficam desligadas por padrão**:

- **Disparo automático**: ativa pela tela "Disparo Automático" do painel, ou via `PATCH /api/auto-dispatch { "enabled": true }`.
- **Bot do Grupo de Automação**: designe um grupo na tela "Grupos" do painel (toggle "Automação"), ou via `PATCH /api/whatsapp/groups/:id { "isAutomationGroup": true }`. Sem isso configurado, o listener existe mas não tem onde escutar — inerte por construção.

**Recomendação**: na primeira vez que for ativar cada um, fique de olho no grupo #08 (poucos participantes) antes de confiar num grupo com audiência real.

## Configuração

**`.env`** — só infraestrutura, precisa de restart pra mudar:

| Variável | Uso |
|---|---|
| `PORT` | Porta do servidor (padrão 3333) |
| `DATABASE_URL` | Caminho do banco SQLite |
| `AUTH_PASSWORD` | Senha de login do painel. **Troque antes de expor o servidor na internet** — veja DEPLOY.md |

**Configurável pelo painel** (banco de dados, sem precisar reiniciar) — em **Configurações**:

| Tela | O que configura |
|---|---|
| Plataformas | Credenciais Shopee (App ID/Secret/Sub-IDs), tag Amazon, tag Mercado Livre |
| Monitoramento Automático | Janela de dedupe (horas pra não capturar o mesmo produto de novo) |
| Configurações Avançadas | Palavras restritas / permitidas |
| Disparo Automático | Janela de horário, intervalos, produtos por execução |

## Endpoints disponíveis (todos sob `/api`, exceto `/api/auth/*`, exigem sessão)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{ password }` — cria sessão, seta cookie |
| POST | `/api/auth/logout` | Encerra a sessão |
| GET | `/api/auth/status` | `{ authenticated }` |
| GET | `/api/health` | Healthcheck |
| GET | `/api/whatsapp/status` | Status da primeira conta WhatsApp |
| GET | `/api/whatsapp/accounts` | Lista todas as contas/números conectados |
| POST | `/api/whatsapp/accounts` | `{ name }` — inicia uma nova conta (QR aparece nos logs do servidor) |
| GET | `/api/whatsapp/accounts/:id/qr` | `{ qr }` — QR code em PNG (data URL) enquanto a conta está pareando |
| GET | `/api/whatsapp/groups` | Lista grupos sincronizados |
| POST | `/api/whatsapp/groups/sync` | Força sincronização (`{ accountId? }`, padrão = primeira conta) |
| PATCH | `/api/whatsapp/groups/:id` | Atualiza `isMonitoring` / `isSending` / `monitoredMarketplaces` / `useOriginalImage` / `isAutomationGroup` / `backupAccountId` |
| POST | `/api/links/convert` | Converte um link (`{ url, subIds? }`) pro marketplace detectado |
| GET | `/api/products` | Lista produtos (filtros: `?marketplace=`, `?groupId=`, `?status=`, `?search=`, `?favorite=true`, `?sort=price_asc\|price_desc\|discount_desc`) — cada item inclui `display` (nome/preço/desconto/cupom já calculados) |
| PATCH | `/api/products/:id` | Atualiza `favorite` e/ou overrides (`nameOverride`, `priceOriginalOverride`, `priceDiscountedOverride`, `couponOverride`) |
| DELETE | `/api/products/:id` | Remove um produto do catálogo |
| GET/POST | `/api/templates` | Lista / cria templates de mensagem |
| PATCH/DELETE | `/api/templates/:id` | Atualiza / remove um template |
| POST | `/api/templates/:id/preview` | Renderiza um template contra um produto (`{ productId }`), sem enviar |
| POST | `/api/messages/send` | Envia mensagem pros grupos agora (`{ groupIds, text }` ou `{ groupIds, productId, templateId? }`) |
| GET/POST | `/api/messages/scheduled` | Lista / cria agendamento (`{ groupIds, scheduledAt (ISO), text }` ou `productId`) |
| DELETE | `/api/messages/scheduled/:id` | Cancela um agendamento pendente |
| GET/PATCH | `/api/auto-dispatch` | Lê / atualiza config do disparo automático (guardrails aplicados no PATCH) |
| GET/PATCH | `/api/settings/platforms` | Lê / atualiza credenciais de marketplace |
| GET/PATCH | `/api/settings/monitoring` | Lê / atualiza palavras restritas/permitidas e janela de dedupe |

Imagens capturadas ficam em `GET /media/<arquivo>` (sem autenticação — risco baixo, nome de arquivo é um UUID aleatório).

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

- **Failover precisa de um segundo chip físico.** O código já suporta múltiplas contas e troca automaticamente pra conta de backup se a principal cair — mas isso só funciona se esse segundo número já for membro do grupo de verdade no WhatsApp (não dá pra automatizar essa parte, é uma ação sua: comprar um chip e adicionar o número aos grupos).
- **Mercado Livre**: conversão de link ainda é manual (sem API pública simples — o original usa uma extensão de navegador pra capturar token, não implementada aqui).
- **Preço/nome de produto**: extraídos por heurística de regex sobre o texto capturado, não por API oficial de dados de produto — funciona bem no formato comum ("Nome\n\nDe R$X por R$Y\n\nCupom: Z"), mas não é 100% garantido.
- **`preview:` do bot**: como não temos API de dados de produto, o preview reflete só o que dá pra extrair do próprio link — sem contexto de mensagem (nome/preço), o resultado fica genérico.
- **`/media` sem autenticação** — baixo risco (nomes de arquivo são UUIDs), mas vale saber.
- **Sessão expira sem redirecionamento automático** — se a sessão do painel expirar (30 dias) no meio do uso, as telas mostram erro em vez de voltar pro login sozinhas; precisa recarregar a página.
- **Sem dado real de comissão.** O card de produto não mostra "Comissão: X%" como no BuboFlow original porque isso vem da API de dados de produto de cada marketplace, que não temos — mostrar um número inventado seria pior que não mostrar nada.
- **"Site" (landing page pública) não implementado** — tela existe em Configurações, mas deixa isso explícito em vez de fingir que funciona. É um projeto à parte (precisa hospedagem/domínio próprio).
- Relatórios (envios, monitor de membros) e reescrita de CTA via IA não foram implementados — item "fase 7" do roadmap original, não essencial pro funcionamento.
