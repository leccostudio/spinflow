# Deploy em VPS

## O que eu preparei vs. o que só você pode fazer

Preparei todo o necessário pra rodar o SpinFlow num servidor de verdade (Docker, docker-compose, migração automática). **O que eu não posso fazer por você**: criar a conta no provedor de VPS e pagar por ela — isso exige seus dados/cartão. Os passos abaixo assumem que você já tem (ou vai criar) um servidor Ubuntu.

## 1. Escolha e crie o VPS

Recomendação (já discutida antes): **Hetzner CX22** (~€4/mês) ou equivalente — 2GB RAM já é suficiente. Qualquer VPS Ubuntu 22.04+ funciona.

Ao criar, guarde: IP do servidor, usuário (geralmente `root`), e configure acesso SSH por chave (mais seguro que senha).

## 2. Instalar Docker no servidor

Conecte via SSH (`ssh root@SEU_IP`) e rode:

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Enviar o código pro servidor

Da sua máquina (ou direto clonando se você subir isso pro GitHub):

```bash
# Opção simples: copiar a pasta inteira via scp (sem node_modules/data)
scp -r SPINFLOW root@SEU_IP:/opt/spinflow
```

## 4. Configurar o `.env` no servidor

No servidor, edite `/opt/spinflow/.env`:

```bash
cd /opt/spinflow
cp .env.example .env
nano .env
```

**Importante — troque a senha antes de expor isso na internet.** A senha atual (`(senha removida)`) foi gerada só pra teste local nesta sessão de desenvolvimento; eu sei o valor dela, então gere uma nova:

```bash
openssl rand -base64 9 | tr -d '+/=' 
```

Cole o resultado em `AUTH_PASSWORD=` no `.env`.

## 5. Subir o container

```bash
docker compose up -d --build
```

Isso builda a imagem (frontend + backend), aplica as migrações do banco automaticamente e sobe o servidor.

## 6. Conectar o WhatsApp (precisa escanear o QR de novo)

O QR code aparece nos logs do container:

```bash
docker compose logs -f
```

Escaneie com o WhatsApp igual fizemos localmente. A sessão fica salva no volume `./data` (persiste entre reinícios do container).

## 7. Acessar o painel com segurança

Por padrão, o `docker-compose.yml` só expõe a porta 3333 em `127.0.0.1` do servidor — **não fica acessível publicamente na internet**, de propósito. Pra acessar do seu computador, abra um túnel SSH:

```bash
ssh -L 3333:localhost:3333 root@SEU_IP
```

E acesse `http://localhost:3333` no seu navegador normalmente — o tráfego vai criptografado pelo túnel SSH, sem precisar de domínio nem certificado HTTPS.

**Se quiser acesso público direto (sem túnel)**: precisa de um domínio + HTTPS (ex.: Caddy como proxy reverso, que já emite certificado Let's Encrypt sozinho) — isso não foi configurado ainda; me avise se quiser que eu prepare.

## 8. Manter rodando (resiliência)

O `docker-compose.yml` já tem `restart: unless-stopped` — o container volta sozinho se cair ou se o servidor reiniciar (desde que o Docker esteja configurado pra iniciar no boot, que é o padrão da instalação oficial).

## 9. Atualizar depois de mudanças no código

```bash
cd /opt/spinflow
# copie os arquivos atualizados (scp) ou git pull, se estiver num repo
docker compose up -d --build
```

As migrações do Prisma rodam automaticamente a cada start (`prisma migrate deploy`), então basta subir de novo.

## 10. Backup

O que importa preservar é a pasta `data/`:
- `data/spinflow.db` — banco (produtos, templates, config)
- `data/auth/` — sessão do WhatsApp (perder isso = precisa escanear QR de novo)
- `data/media/` — imagens capturadas

Recomendo um cron simples de backup (ex.: `tar` + copiar pra outro lugar) — posso preparar isso se quiser.

## Status de validação

Testei localmente (sem Docker instalado nesta máquina) cada peça que o Dockerfile executa: `npm ci` equivalente, `prisma generate`, `tsc` build, `prisma migrate deploy`, e rodar `node dist/index.js` compilado — tudo funcionou. **O `docker build` em si não foi testado** porque Docker não está instalado aqui. Se algo der erro no build da imagem, me manda a mensagem de erro que eu ajusto.
