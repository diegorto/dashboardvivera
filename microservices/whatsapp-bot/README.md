# whatsapp-bot (Vivera) - notas operacionais

## Incidente de 2026-07-28: QR sumiu / bot desconectou

### Sintoma
O QR Code parou de aparecer na aba "Conexao" do CRM e o bot ficou
desconectado. O WhatsApp do celular continuava funcionando normalmente
(nao era bloqueio de numero/conta).

### Causa raiz
Erro 405 ("Method Not Allowed"/connection failure) no handshake do
Baileys: o WhatsApp rejeitou a versao do protocolo WA Web que o
`fetchLatestBaileysVersion()` retornou, ANTES mesmo de gerar o QR.
E um bug documentado do Baileys (ver issues #2370, #2485, #1427 em
github.com/WhiskeySockets/Baileys): o fetch de versao mais recente as
vezes retorna algo que o proprio WhatsApp ja rejeita, e o `catch` desse
fetch nao definia nenhum fallback (deixava `waVersion` undefined).

Descartado antes de chegar nessa conclusao: corrupcao do
`auth_session` (zeramos a pasta e o erro persistiu) e bloqueio de IP do
VPS (o erro 405 acontece no handshake, antes de qualquer geracao de QR,
e e reportado por outras pessoas em redes diferentes - nao e especifico
de IP).

### Como diagnosticar se acontecer de novo
1. `pm2 logs vivera-whatsapp-bot --lines 200 --nostream | grep -E "code ="`
   - `code = 405` repetido = rejeicao de versao do protocolo (este incidente).
   - `code = 408` = so o QR expirou sem ninguem escanear (normal, nao e bug).
2. Conferir status real no banco (nao confiar só no QR aparecer na tela):
   `SELECT status, updated_at FROM whatsapp_sessions WHERE session_name='default'`
   - `qr_pending` = QR gerado, aguardando scan.
   - `connected` = de fato conectado.
3. Ver `logs/whatsapp-health-alerts.log` (healthcheck do cron, ver abaixo).

### Correcoes aplicadas (services/whatsapp.js)
- **Versao fixa de fallback**: `FALLBACK_WA_VERSION` fica hardcoded no
  topo do arquivo. Se `fetchLatestBaileysVersion()` falhar, ou se a
  ultima conexao fechou com `code === 405`, o bot usa essa versao fixa
  direto na proxima tentativa (flag `lastCloseWasVersionRejected`).
  **Se o erro 405 voltar a acontecer de forma persistente**, atualize
  o valor de `FALLBACK_WA_VERSION` (rode `fetchLatestBaileysVersion()`
  manualmente pra pegar uma versao atual que o WhatsApp ainda aceite).
- **Backoff exponencial diferenciado no reconnect**: erros reais (405,
  rede, etc) usam backoff exponencial 3s -> 6s -> 12s -> ... ate um
  teto de 120s (reseta ao conectar). Ja o `code === 408` (QR so
  expirou, ninguem escaneou) usa um delay fixo curto de 3s e NAO conta
  pro backoff - senao a renovacao do QR fica lenta (ate 2min) so por
  ninguem ter escaneado ainda, o que parece bug mas nao e.

### Healthcheck automatico (independente de qualquer sessao de IA/Claude)
- `scripts/whatsapp-healthcheck.js`, rodando via **cron do proprio VPS**
  a cada 5 minutos (`crontab -l` pra ver o agendamento).
- Le o status em `whatsapp_sessions` e, se ficar diferente de
  `connected` por mais de 15 minutos seguidos, grava um alerta em
  `logs/whatsapp-health-alerts.log` (formato `[ALERT <timestamp>] ...`).
  Repete o alerta a cada 1h enquanto continuar desconectado.
- **Por enquanto e so log, sem webhook/email/notificacao externa**
  (decisao do Diego ate ele definir um canal).
- Estado interno (ultima vez conectado, ultimo alerta) fica em
  `logs/.health-state.json` - pode apagar esse arquivo pra "resetar" o
  healthcheck se precisar.

### Indicador de status no CRM
A aba "Conexao" (`crm-server/public/whatsapp.html`) ja faz polling
automatico do `/status` a cada 5s (`setInterval(refreshStatus, 5000)`),
entao o badge/QR atualiza sozinho sem precisar recarregar a pagina.
Isso ja foi conferido e esta correto - nao precisou de mudanca.

### Backups
Antes de qualquer edicao em `services/whatsapp.js`, sempre existe um
`.bak_<timestamp>` na mesma pasta. Em caso de regressao, comparar com
`diff services/whatsapp.js services/whatsapp.js.bak_<timestamp mais recente antes do problema>`.
