# whatsapp-monitor

Monitoramento dos 2 numeros de WhatsApp (Helenice e Agda) via Baileys, com
sincronizacao bidirecional de etiquetas com o Pipedrive e analise diaria de
aderencia ao script via n8n. Roda como um servico Docker a parte, no mesmo
padrao do `vivera-fotos`.

## Como funciona

- Cada SDR tem uma sessao Baileys propria (QR code independente). Mensagens e
  chamadas recebidas/enviadas por qualquer uma delas caem no MySQL.
- A cada 5 minutos, `syncDistribution` busca deals abertos no Pipedrive e
  cria/atualiza a conversa correspondente (responsavel, etapa, valor,
  etiquetas), usando o mapeamento em `pipedrive_users_mapping`.
- Etiquetas adicionadas pelo painel SDR sao replicadas de volta pro deal no
  Pipedrive (`PUT /deals/:id`).
- Todo dia as 18:05, `analyzeConversationsDaily` manda as conversas do dia
  pro webhook do n8n (`N8N_WEBHOOK`), que devolve nota de aderencia ao script
  por conversa; o resultado alimenta `daily_metrics` e o `/dashboard`.
- Ao preparar uma ligacao (`/api/prepare-call`), se a sessao da propria SDR
  estiver em chamada (`in_call`), o sistema sugere o numero da outra SDR
  (par de fallback definido em `whatsapp_sessions.fallback_session`) em vez
  do dela. A discagem em si e manual - Baileys nao consegue iniciar uma
  chamada de voz, so recebe eventos de chamada.

## Setup no servidor

1. Criar o banco e rodar o schema:
   ```bash
   mysql -u root -p -e "CREATE DATABASE vivera_whatsapp"
   mysql -u root -p vivera_whatsapp < sql/schema.sql
   ```
2. Copiar `.env.example` para `.env` e preencher (`DB_*`, `PIPEDRIVE_TOKEN`,
   `N8N_WEBHOOK`, `SESSION_SECRET`, `SDR_PASSWORD_HELENICE`,
   `SDR_PASSWORD_AGDA`).
3. Mapear os usuarios do Pipedrive pra cada SDR (IDs reais, via
   `GET /users` na API do Pipedrive):
   ```sql
   INSERT INTO pipedrive_users_mapping (pipedrive_user_id, pipedrive_user_name, sdr_name)
   VALUES ('123456', 'Helenice', 'helenice'), ('789012', 'Agda', 'agda');
   ```
4. Subir o servico (a partir da raiz do repo, junto com os outros):
   ```bash
   docker compose up -d --build whatsapp-monitor
   ```
   O `docker-compose.yml` espera o DNS `whatsapp.vivera.srv1522176.hstgr.cloud`
   apontado pro Traefik - ajustar o `Host()` no label se o subdominio for
   outro. O volume `./whatsapp-monitor/auth` guarda as credenciais das
   sessoes Baileys entre restarts - nao apagar.
5. Configurar os webhooks no Pipedrive apontando pra:
   - `https://<seu-dominio>/webhook/pipedrive/deal`
   - `https://<seu-dominio>/webhook/pipedrive/label`
6. Acessar `/login`, escolher a sessao (Helenice ou Agda), entrar com a
   senha configurada e escanear o QR code exibido em `/api/qr/:sessionName`
   com o WhatsApp do respectivo numero.

## Rotas

- `GET /login`, `POST /login`, `POST /logout`
- `GET /api/qr/:sessionName` - status/QR code da sessao
- `GET /sdr/:sdrName` - painel da SDR (exige estar logada como ela mesma)
- `POST /api/send-message`, `POST /api/prepare-call`, `POST /api/add-label`
- `GET /api/conversation/:conversationId`
- `POST /webhook/pipedrive/deal`, `POST /webhook/pipedrive/label`
- `GET /dashboard` - conformidade de script dos ultimos 7 dias

## O que ainda depende de teste real

Isso foi montado e revisado localmente (instala, sobe, sintaxe ok), mas sem
acesso a um WhatsApp, MySQL, Pipedrive ou n8n reais - precisa validar no
servidor:
- Conexao Baileys de fato (QR code, persistencia da sessao em `auth/`,
  reconexao automatica).
- Formato exato do payload dos webhooks do Pipedrive (o codigo assume o
  formato antigo `{ current: {...} }` da v1, como especificado).
- Deteccao de `in_call` a partir dos status de chamada do Baileys (os
  valores exatos de `status` podem variar por versao da lib).
