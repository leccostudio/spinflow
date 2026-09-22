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

## Estado atual (Sprint 1 — Base)

- [x] Servidor Fastify + Prisma/SQLite
- [x] Conexão WhatsApp via Baileys (QR pairing, reconexão automática)
- [x] Sincronização de grupos (`POST /whatsapp/groups/sync`)
- [x] Toggle de monitoramento/envio por grupo (`PATCH /whatsapp/groups/:id`)

## Endpoints disponíveis

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Healthcheck |
| GET | `/whatsapp/status` | Status da conexão WhatsApp |
| GET | `/whatsapp/groups` | Lista grupos sincronizados |
| POST | `/whatsapp/groups/sync` | Força sincronização da lista de grupos do WhatsApp conectado |
| PATCH | `/whatsapp/groups/:id` | Atualiza `isMonitoring` / `isSending` de um grupo |

## Próximos passos (roadmap enxuto)

1. Conversão de link (Shopee API, Amazon por tag, Mercado Livre manual)
2. Captura de produtos nos grupos monitorados + filtros de palavras
3. Motor de templates + envio manual com preview
4. Agendamento + disparo automático (com guardrails anti-ban)
5. Bot do Grupo de Automação (comandos via WhatsApp)
