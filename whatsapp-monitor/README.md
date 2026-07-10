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

## Setup no servidor (automatico)

O banco (MariaDB) roda como container proprio (`whatsapp-db` no
`docker-compose.yml`), com o schema em `sql/schema.sql` aplicado sozinho no
primeiro start - nao precisa de MySQL/senha de root pre-existente na VPS.

```bash
cd whatsapp-monitor
bash setup.sh
```

Isso gera `SESSION_SECRET` e as senhas de login de cada SDR aleatoriamente,
reaproveita o `PIPEDRIVE_TOKEN` que ja esta no `.env` da raiz do repo, ja
deixa `N8N_WEBHOOK` configurado, sobe `whatsapp-db` + `whatsapp-monitor` via
docker compose e tenta mapear Helenice/Agda pros IDs de usuario delas no
Pipedrive automaticamente. No final imprime a URL do painel e a senha de
login de cada uma.

O unico passo que não dá pra automatizar: abrir `http://<ip-da-vps>:4001/login`,
entrar em cada sessão com a senha impressa pelo script e escanear o QR code
com o WhatsApp do número correspondente.

Se o mapeamento automático do Pipedrive não achar os usuários (nomes
diferentes de "Helenice"/"Agda" no Pipedrive), preenche manualmente:
```sql
INSERT INTO pipedrive_users_mapping (pipedrive_user_id, pipedrive_user_name, sdr_name)
VALUES ('123456', 'Helenice', 'helenice'), ('789012', 'Agda', 'agda');
```

Pra ativar a sincronização de deals, configura os webhooks no Pipedrive
apontando pra:
- `https://<seu-dominio-ou-ip>:4001/webhook/pipedrive/deal`
- `https://<seu-dominio-ou-ip>:4001/webhook/pipedrive/label`

Se quiser o domínio bonito com TLS em vez de `IP:4001`, o
`docker-compose.yml` já tem os labels do Traefik prontos - só apontar o DNS
`whatsapp.vivera.srv1522176.hstgr.cloud` (ou trocar o `Host()` no label pelo
subdomínio que preferir).

O volume `./whatsapp-monitor/auth` guarda as credenciais das sessões Baileys
entre restarts - não apagar. `./whatsapp-monitor/db-data` guarda os dados do
MariaDB - idem.

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
acesso a um WhatsApp, MySQL ou Pipedrive reais - precisa validar no servidor:
- Conexao Baileys de fato (QR code, persistencia da sessao em `auth/`,
  reconexao automatica).
- Formato exato do payload dos webhooks do Pipedrive (o codigo assume o
  formato antigo `{ current: {...} }` da v1, como especificado).
- Deteccao de `in_call` a partir dos status de chamada do Baileys (os
  valores exatos de `status` podem variar por versao da lib).

O webhook de analise do n8n (`N8N_WEBHOOK`) ja esta montado e ativo em
`https://n8n.srv1522176.hstgr.cloud/webhook/whatsapp-script-analysis`,
devolvendo `{ results: [{ conversation_id, adherence_score, issues,
suggestions, ... }] }` - compativel com o que `ia-analysis.js` espera.
