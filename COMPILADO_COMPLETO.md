# 📊 Dashboard WhatsApp Analytics - Documentação Compilada

## Versão 1.0 | Julho 2026

---

## 🎯 O QUE É ESTE PROJETO

Um **dashboard analytics completo para WhatsApp Business** com integração N8N, análise em tempo real, automação 24/7 e controle remoto via API.

### Principais Features:

- ✅ Dashboard em tempo real com gráficos Chart.js
- ✅ KPIs de performance (chamadas, taxa atendimento, duração)
- ✅ Integração N8N para análise de compliance
- ✅ APIs RESTful para integração com sistemas
- ✅ Controle remoto via API e CLI
- ✅ Automação 24/7 com PM2 e cron jobs
- ✅ Auto-atualização a cada 30 segundos

---

## 🏗️ ARQUITETURA DO PROJETO

### Stack Tecnológico:

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Node.js + Express.js |
| Frontend | HTML/CSS/Vanilla JavaScript |
| Gráficos | Chart.js 4.4.0 |
| Process Manager | PM2 |
| Scheduler | node-cron |
| Integrações | N8N, Pipedrive, WhatsApp |

### Estrutura de Pastas:

```
dashboardvivera/
├── server.js                      # Express app (650 linhas)
├── package.json                   # Dependências
├── DEPLOY_VPS.sh                 # Deploy automático
├── remote-client.js              # CLI controle remoto
├── ecosystem.config.js           # Configuração PM2
├── views/
│   └── dashboard-whatsapp.html   # HTML dashboard
├── public/
│   ├── css/dashboard-whatsapp.css   # Estilos (15K)
│   ├── js/dashboard-whatsapp.js     # Lógica (18K)
│   └── js/auto-updater.js           # Auto-refresh
└── src/
    ├── remote-control.js         # API remota
    ├── auto-scheduler.js         # Cron jobs
    └── n8n-webhook.js            # Webhook N8N
```

---

## 🔌 ENDPOINTS DA API

### Dashboard Endpoints (WhatsApp Analytics):

```
GET /api/whatsapp/stats              → KPIs principais
GET /api/whatsapp/calls              → Histórico de chamadas
GET /api/whatsapp/lead-timing        → Tempo até primeira msg/ligação
GET /api/whatsapp/patterns           → Padrões de uso por hora
GET /api/whatsapp/message-types      → Efetividade por tipo
GET /api/whatsapp/script-compliance  → Dados N8N
```

### Remote Control Endpoints:

```
POST /api/remote/deploy              → Deploy código novo
POST /api/remote/restart             → Reiniciar servidor
GET  /api/remote/status              → Status do servidor
GET  /api/remote/logs                → Ver logs
POST /api/remote/clear-cache         → Limpar cache
GET  /api/remote/health-detailed     → Saúde detalhada
```

### Autenticação:

```
Header: x-control-token: dashboard-vivera-2026
```

---

## ⚙️ SETUP & INSTALAÇÃO

### Desenvolvimento Local:

```bash
cd dashboardvivera
npm install
npm start

# Acesso: http://localhost:3000
```

### Deployment VPS (Production):

```bash
ssh root@SEU_VPS_IP
git clone https://github.com/diegorto/dashboardvivera.git
cd dashboardvivera
bash DEPLOY_VPS.sh
```

### Variáveis de Ambiente (.env):

```env
NODE_ENV=production
PORT=3000
PIPEDRIVE_TOKEN=seu_token
CONTROL_TOKEN=dashboard-vivera-2026
DATABASE_URL=sua_url
```

---

## ✨ FEATURES DETALHADAS

### Dashboard - KPI Cards:

- **Total de Chamadas** - número total realizadas
- **Chamadas Atendidas** - conversas bem-sucedidas
- **Taxa de Atendimento** - percentual de sucesso
- **Tempo Médio** - duração média

### Gráficos Interativos (Chart.js):

- Tempo até Primeira Mensagem
- Tempo até Primeira Ligação
- Taxa de Atendimento por Hora do Dia

### Tabelas com Paginação:

- Efetividade por Tipo de Mensagem (20 itens/página)
- Últimas Chamadas com filtros (status, data, SDR)
- Navegação: Anterior/Próxima

### Análise de Compliance (N8N):

- Taxa Geral de Conformidade (com gauge visual)
- Conformidade por SDR
- Problemas Detectados
- Insights Automáticos

### Auto-Atualização:

- Dashboard atualiza a cada 30 segundos
- Sem necessidade de refresh manual
- Dados em tempo real

---

## 🎛️ REMOTE CONTROL SYSTEM

### CLI (Command Line Interface):

```bash
node remote-client.js status 187.77.249.55          # Ver status
node remote-client.js deploy 187.77.249.55          # Fazer deploy
node remote-client.js restart 187.77.249.55         # Reiniciar
node remote-client.js logs 187.77.249.55            # Ver logs
node remote-client.js health 187.77.249.55          # Health check
node remote-client.js clear-cache 187.77.249.55     # Limpar cache
node remote-client.js update-env KEY VALUE IP      # Atualizar env
```

### Web Dashboard:

```
http://SEU_VPS:3000/remote
(requer token no header)
```

### REST API:

```bash
curl -H "x-control-token: dashboard-vivera-2026" \
  http://SEU_VPS:3000/api/remote/status
```

---

## 🤖 AUTOMAÇÃO 24/7

### Tarefas Agendadas (Cron):

| Tarefa | Frequência | Função |
|--------|-----------|--------|
| Data Sync | A cada 5 min | Busca dados do Pipedrive/WhatsApp |
| Health Check | A cada 5 min | Verifica se servidor está up |
| Script Analysis | Diário 6:05 PM | Análise N8N compliance |
| Cache Cleanup | Diário 2:00 AM | Limpeza de dados antigos |
| Auto-restart | Contínuo | PM2 monitora e reinicia se cair |

**Você não precisa fazer nada - tudo é automático! ✨**

---

## 🔗 INTEGRAÇÕES

### Pipedrive API:
- Sincroniza dados de leads e conversas
- Configure `PIPEDRIVE_TOKEN` no `.env`

### N8N Webhooks:
- Recebe eventos de compliance e análise de script em tempo real
- Endpoint: `/n8n-webhook`

### WhatsApp Baileys:
- Monitor de mensagens WhatsApp em tempo real
- Roda na porta 4001

---

## 🔐 SEGURANÇA

### Autenticação:
- ✅ Token-based authentication via header `x-control-token`
- ✅ Tokens configuráveis via `update-env`
- ✅ Padrão: `dashboard-vivera-2026` (MUDE EM PRODUÇÃO)

### Comandos Whitelisted:
- `pm2 status`, `pm2 logs`, `pm2 restart`
- `npm install`, `git pull`, `git status`
- `ls -la`, `pwd`, `whoami`, `df -h`

### Production Hardening:
1. Mude o token padrão imediatamente
2. Use HTTPS reverse proxy (Nginx/Traefik)
3. Restrinja porta 3000 à rede local
4. Habilite firewall rules

---

## 🔧 TROUBLESHOOTING

### Problema: Porta 3000 já em uso

```bash
lsof -i :3000
kill -9 <PID>
```

### Problema: PM2 em crash loop

```bash
pm2 kill
pm2 start ecosystem.config.js
```

### Problema: Dashboard sem estilos (CSS não carrega)

Verificar se `app.use(express.static(...))` está em `server.js` linha 24.

### Problema: APIs retornam 404

Verificar se as rotas estão definidas em `server.js` a partir da linha 452.

### Problema: Servidor não responde via HTTP

```bash
ssh root@SEU_VPS
pm2 kill
cd /root/dashboardvivera
git pull origin claude/dashboard-structure-exploration-53agnp
npm install
npm start
```

---

## 📊 EXEMPLOS DE RESPOSTAS DA API

### GET /api/whatsapp/stats

```json
{
  "totalCalls": 1250,
  "answeredCalls": 892,
  "answerRate": 71.36,
  "avgDuration": 245,
  "avgFirstMessageTime": 15,
  "avgFirstCallTime": 22,
  "messageImpactRate": 18.5
}
```

### GET /api/whatsapp/calls (Página 1)

```json
{
  "calls": [
    {
      "id": "call_123",
      "name": "João Silva",
      "number": "11999999999",
      "timestamp": "2026-07-17T14:30:00Z",
      "duration": 245,
      "sdr": "Maria",
      "status": "completed",
      "hadPreviousMessage": true
    }
  ],
  "total": 1250,
  "page": 1,
  "pageSize": 20,
  "totalPages": 63
}
```

---

## 🎯 CASOS DE USO

### Caso 1: Visualizar Dashboard

```
Acesse: http://SEU_VPS:3000/
```

### Caso 2: Deploy de Novo Código

```bash
git push origin claude/dashboard-structure-exploration-53agnp
node remote-client.js deploy SEU_VPS
```

### Caso 3: Limpar Cache e Reiniciar

```bash
node remote-client.js clear-cache SEU_VPS
node remote-client.js restart SEU_VPS
```

### Caso 4: Ver Logs em Tempo Real

```bash
node remote-client.js logs SEU_VPS
```

### Caso 5: Atualizar Variável de Ambiente

```bash
node remote-client.js update-env PIPEDRIVE_TOKEN "novo-token" SEU_VPS
```

---

## 📝 NOTAS FINAIS & SUPORTE

### Status do Projeto:

- ✅ Código pronto para produção
- ✅ Todos os componentes testados e validados
- ✅ Documentação completa
- ✅ Deploy automatizado
- ✅ Controle remoto funcionando

### Recursos Adicionais:

- **README_DASHBOARD.md** - Overview completo do projeto
- **STATUS_VERIFICACAO.md** - Verificação de status atual
- **DEPLOY_VPS.sh** - Script de deployment automático
- **remote-client.js** - CLI para controle remoto
- **ecosystem.config.js** - Configuração PM2

### Informações do Projeto:

- **Licença:** MIT
- **Versão:** 1.0
- **Data:** Julho 2026
- **Repository:** github.com/diegorto/dashboardvivera
- **Branch:** claude/dashboard-structure-exploration-53agnp

---

## 🚀 QUICK REFERENCE

| Tarefa | Comando |
|--------|---------|
| Ver dashboard | `http://SEU_VPS:3000/` |
| Fazer deploy | `node remote-client.js deploy SEU_VPS` |
| Reiniciar | `node remote-client.js restart SEU_VPS` |
| Ver logs | `node remote-client.js logs SEU_VPS` |
| Health check | `node remote-client.js health SEU_VPS` |
| Limpar cache | `node remote-client.js clear-cache SEU_VPS` |
| Status remoto | `node remote-client.js status SEU_VPS` |
| Atualizar env | `node remote-client.js update-env KEY VALUE SEU_VPS` |

---

**Pronto para usar em outro projeto! Você tem agora documentação completa, exemplos e instruções passo a passo.** 🎉
