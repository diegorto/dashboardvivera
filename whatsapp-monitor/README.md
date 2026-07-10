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

O MySQL e responsabilidade externa (reaproveita um container/instancia que ja
exista, ex: `vivera-mysql`) - rode `sql/schema.sql` nele uma vez e preencha
`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` no `.env`.

```bash
cd whatsapp-monitor
bash setup.sh
```

`setup.sh` **nao mexe em nada que voce ja tiver preenchido** - so completa o
que estiver faltando: gera `SESSION_SECRET` e as senhas de login de cada SDR
aleatoriamente, reaproveita o `PIPEDRIVE_TOKEN` que ja esta no `.env` da raiz
do repo, ja deixa `N8N_WEBHOOK` configurado, e testa se `DB_HOST` esta
alcancavel a partir de onde o script roda (o erro mais comum aqui: usar o
nome do container Docker do MySQL como `DB_HOST` enquanto a app roda via
`npm start` direto no host - nesse caso o nome do container so resolve de
dentro da rede Docker, o certo e `DB_HOST=127.0.0.1` com a porta publicada
pro host).

Depois disso, sobe a aplicacao:
```bash
npm install && npm start
# ou, pra continuar rodando depois de fechar o terminal:
npx pm2 start server.js --name whatsapp-monitor
```

Ou, se preferir rodar em container (mesmo padrao do `vivera-fotos`, com
restart automatico e Traefik prontos no `docker-compose.yml` da raiz):
```bash
docker compose up -d --build whatsapp-monitor
```
Nesse caso `DB_HOST` só resolve pelo nome do container se `vivera-mysql`
estiver na mesma rede Docker (`n8n_default`) que o `whatsapp-monitor`.

O unico passo que não dá pra automatizar de jeito nenhum: abrir
`http://<ip-da-vps>:4001/login`, entrar em cada sessão com a senha gerada
pelo `setup.sh` e escanear o QR code com o WhatsApp do número correspondente.

Se o mapeamento automático do Pipedrive não achar os usuários certos,
preenche manualmente:
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
entre restarts - não apagar.

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
