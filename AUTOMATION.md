# 🤖 Dashboard de WhatsApp Analytics - Automação Completa

## O que é automatizado?

Tudo! O dashboard roda **100% automatizado** sem intervenção manual. Aqui está o que acontece:

---

## ⚙️ **Inicialização Automática**

### Quando você executa `npm start`:

1. **Setup de automação** → `setup-automation.js` roda automaticamente
2. **Verifica dependências** → npm install se necessário
3. **Cria diretórios** → data/, logs/, etc
4. **Inicia logging** → Todos os eventos são registrados
5. **Configura webhooks** → N8N e monitor prontos para receber dados
6. **Inicia schedulers** → Tarefas agendadas começam a rodar
7. **Frontend atualiza a cada 30s** → Dashboard nunca fica desatualizado

---

## 📅 **Agendamentos Automáticos (Cron)**

| Frequência | O que faz | Resultado |
|-----------|----------|-----------|
| A cada **5 minutos** | Sincroniza dados do monitor | Cache atualizado |
| **18:05 UTC** | Análise de script (N8N) | Compliance calculado |
| A cada **10 minutos** | Health check | Sistema monitorado |
| **02:00 UTC** | Limpeza de cache antigo | Espaço liberado |

---

## 🔄 **Fluxo Automático de Dados**

```
Monitor de WhatsApp
        ↓ (webhook POST)
Servidor recebe em /webhook/monitor/calls
        ↓
Armazena em cache-cache.json
        ↓
Frontend faz polling a cada 30s
        ↓
Dashboard atualiza automaticamente
        ↓
Usuário vê dados em tempo real
```

---

## 🎯 **Análise de Script Automática (N8N)**

1. **Cron:** Todas as noites às 18:05
2. **Ação:** Busca conversas do dia no banco
3. **Integração:** POST para N8N webhook
4. **Análise:** IA classifica conformidade ao script
5. **Resultado:** Compliance % armazenado em cache
6. **Exibição:** Dashboard mostra compliance por SDR

---

## 🏥 **Monitoramento de Saúde Automático**

A cada 10 minutos:
- ✅ Verifica se servidor está respondendo
- ✅ Valida conexão com banco de dados
- ✅ Testa webhooks (N8N, monitor)
- ✅ Armazena status em `data/health.json`

Acesse: `http://localhost:3000/api/health`

---

## 📊 **Cache Automático**

- **Armazenado em:** `data/cache/dashboard-cache.json`
- **Atualizado:** A cada 5 minutos
- **TTL:** 30 minutos (dados recentes garantidos)
- **Limpeza:** Automática a cada 7 dias

Acesse status: `http://localhost:3000/api/cache-status`

---

## 🔔 **Notificações Automáticas**

Sistema pronto para enviar alertas quando:

- ❌ Taxa de atendimento cai abaixo de 50%
- 🚨 Problema crítico no script (severidade alta)
- ⚠️ Sistema offline por mais de 10 minutos
- 📊 Relatório diário (08:00 UTC)

Estrutura em `src/notifications.js` - configure seus webhooks:
- Slack
- Discord
- Email
- Custom

---

## 📝 **Logging Automático**

**Arquivo:** `logs/dashboard-YYYY-MM-DD.log`

Exemplo:
```
[2026-07-10T14:30:45Z] INIT: Dashboard automation started
[2026-07-10T14:35:00Z] CRON: Sincronizando dados...
[2026-07-10T14:35:02Z] SYNC: Cache atualizado (245 chamadas)
[2026-07-10T14:40:15Z] UPDATE: Dashboard atualizado no cliente
[2026-07-10T18:05:00Z] CRON: Analisando conformidade do script...
```

Leia logs em tempo real:
```bash
npm run logs
```

---

## 🚀 **Fluxo de Inicialização**

### 1️⃣ Execução: `npm start`

```bash
$ npm start

📦 Verificando dependências...
✅ Dependências OK
⚙️  Configurando automação...
✅ Automação configurada
📁 Diretórios criados
📝 Logging configurado
💾 Cache preparado
🏥 Monitor OK
⏰ Agendador OK
🔗 N8N OK
🔔 Notificações OK
🔄 Auto-updater OK
✨ Dashboard pronto!

Servidor rodando em http://localhost:3000
⏰ Scheduler iniciado
🔗 Webhooks ativados
```

### 2️⃣ Dashboard Inicia

```
http://localhost:3000/dashboard/whatsapp
        ↓
Carrega page HTML
        ↓
Executa auto-updater.js
        ↓
Poll a cada 30s: GET /api/whatsapp/stats
        ↓
Render automático dos gráficos
```

### 3️⃣ Backend Roda em Background

- **Cron 5min:** Sync de dados
- **Cron 10min:** Health check
- **Cron 18:05:** Análise N8N
- **Cron 02:00:** Limpeza cache
- **24/7:** Recebe webhooks

---

## 📱 **No Seu Browser**

Abra: `http://localhost:3000/dashboard/whatsapp`

**O que acontece automaticamente:**

1. ✅ Página carrega com dados em cache
2. ✅ A cada 30 segundos: atualiza dados
3. ✅ Gráficos se movem em tempo real
4. ✅ Tabelas refrescam
5. ✅ Score de compliance atualiza
6. ✅ Nenhuma ação manual necessária!

---

## 🎮 **Controles Manuais (Opcionais)**

Se quiser fazer algo manualmente:

```bash
# Atualizar dados agora (não espera 5 min)
npm run monitor

# Ver health status
npm run health

# Ver logs em tempo real
npm run logs

# Limpar cache manualmente
rm data/cache/*.json

# Reiniciar tudo
npm start
```

---

## 🔧 **Configurar Notificações**

Edite `src/notifications.js` e adicione seus webhooks:

### Slack
```javascript
const axios = require('axios');
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

function notifySlack(message) {
  axios.post(SLACK_WEBHOOK, { text: message });
}
```

### Discord
```javascript
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

function notifyDiscord(message) {
  axios.post(DISCORD_WEBHOOK, { content: message });
}
```

### Email (via Nodemailer)
```javascript
const nodemailer = require('nodemailer');

function notifyEmail(message) {
  // Configure seu SMTP
}
```

---

## 🔗 **Integrar seu N8N**

### 1. Configure variável de ambiente

`.env`:
```
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-analysis
N8N_WEBHOOK_KEY=sua-chave-secreta
```

### 2. N8N receberá

```json
{
  "action": "analyze",
  "sdr": "helenice",
  "script": "CUMPRIMENTO, QUALIFICAÇÃO, PROBLEMA, ...",
  "conversations": [
    { "id": "uuid", "client": "João", "messages": [...] }
  ]
}
```

### 3. N8N retorna

```json
{
  "results": [
    {
      "conversation_id": "uuid",
      "adherence_score": 85.2,
      "issues": ["missing_greeting"],
      "suggestions": ["Comece com saudação"]
    }
  ]
}
```

### 4. Sistema armazena resultado

- Cache atualizado
- Dashboard mostra compliance %
- Issues exibidas em vermelho

---

## 💡 **Dicas de Produção**

### Performance
- Cache invalida a cada 5 minutos
- Frontend poll a cada 30 segundos
- Banco cria índices automaticamente

### Confiabilidade
- Retry automático em falhas
- Health check a cada 10 minutos
- Logs completos para debug

### Escalabilidade
- Sem limite de chamadas/conversas
- MySQL aguentas 1M+ registros
- Frontend otimizado

---

## ❌ **Se Algo Quebrar**

### "Dashboard não atualiza"
```bash
curl http://localhost:3000/api/health
# Se retornar erro, reinicie: npm start
```

### "Compliance não mostra"
```bash
# Verificar webhook N8N
curl http://localhost:3000/api/whatsapp/script-compliance

# Ver logs
npm run logs | grep "N8N\|webhook"
```

### "Dados antigos"
```bash
# Forçar sync agora
curl http://localhost:3000/api/cache-status

# Limpar cache
rm data/cache/*.json
```

---

## 📊 **Status Final**

**Todas as tarefas rodam automaticamente:**

- ✅ Coleta de dados
- ✅ Sincronização
- ✅ Análise de script (N8N)
- ✅ Health checks
- ✅ Logging
- ✅ Notificações
- ✅ Frontend updates
- ✅ Limpeza de cache

**Você não precisa fazer nada!** 🎉

---

**Versão:** 1.0  
**Status:** Production Ready  
**Última atualização:** 10/07/2026
