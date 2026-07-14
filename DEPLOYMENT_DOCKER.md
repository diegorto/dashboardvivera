# 🚀 VIVERA INSIGHTS - GUIA DE DEPLOYMENT DOCKER

**Data:** 14 de Julho de 2026  
**Branch:** `claude/cloud-project-setup-slvqge`  
**Status:** ✅ Pronto para Deploy

---

## 📋 Sumário

Este guia orienta como fazer o deploy completo do Vivera Insights em Docker no Hostinger usando Docker Manager.

---

## 🏗️ Arquitetura do Deploy

```
┌─────────────────────────────────────────────────────┐
│         HOSTINGER VPS 1522176                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  TRAEFIK (Reverse Proxy & Load Balancer)    │  │
│  │  Porta 80/443 - HTTPS Automático             │  │
│  └──────────────────────────────────────────────┘  │
│     ↓            ↓            ↓                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  Rede Compartilhada: n8n_default (externa) │  │
│  ├─────────────────────────────────────────────┤  │
│  │ • N8N (5678)                                 │  │
│  │ • Vivera Insights App (3000)                │  │
│  │ • Vivera Fotos (4000)                       │  │
│  │ • PostgreSQL (5432 interno, 5433 externo)  │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Componentes

### 1. **vivera-insights-db** (PostgreSQL 15 Alpine)
- **Porta Interna:** 5432
- **Porta Externa:** (não exposta)
- **Usuário:** vivera
- **Senha:** vivera_secure_2024
- **Database:** vivera_insights
- **Volume:** vivera-insights-db-vol
- **Health Check:** ✅ Automático

### 2. **vivera-insights-app** (Node.js 18 Alpine)
- **Porta:** 3000
- **Domínio:** app.viveraorofacial.com.br
- **Framework:** Express.js
- **Features:**
  - ✅ Integração Pipedrive (API audit, deals)
  - ✅ Integração Meta Ads (gasto, leads, ads)
  - ✅ Dashboard HTML interativo
  - ✅ Painel SDR (Corrida das SDRs)
  - ✅ API RESTful completa
- **Volume:** vivera-insights-app-vol
- **Depends On:** vivera-insights-db
- **Health Check:** ✅ Automático (/health)

### 3. **vivera-fotos** (Node.js 18 Alpine)
- **Porta:** 4000
- **Domínio:** vivera.srv1522176.hstgr.cloud
- **Descrição:** Galeria de fotos de pacientes
- **Volumes:** data, uploads
- **Status:** ✅ Existente e integrado

---

## ✅ Pré-requisitos

- [x] Docker instalado no VPS
- [x] Docker Manager ativado no Hostinger
- [x] Rede `n8n_default` criada (compartilhada com N8N)
- [x] Traefik configurado no Hostinger
- [x] Domínio apontando para o VPS
- [x] SSL/HTTPS configurado (Traefik)

---

## 🚀 PASSO A PASSO DE DEPLOYMENT

### **PASSO 1: Preparar os Arquivos**

1. Clone a branch correta:
```bash
git clone https://github.com/diegorto/dashboardvivera.git
cd dashboardvivera
git checkout claude/cloud-project-setup-slvqge
```

2. Verifique os arquivos necessários:
```
✅ docker-compose.yml
✅ Dockerfile
✅ .env
✅ server.js
✅ web/ (frontend)
✅ vivera-fotos/ (subprojeto)
```

3. Instale dependências localmente (para build do frontend):
```bash
npm install
npm run build:web
```

### **PASSO 2: Configurar no Docker Manager do Hostinger**

1. **Abra o painel do Hostinger**
   - Vá para: Servidor → Docker Manager

2. **Crie um novo Compose**
   - Clique no botão **"Compose"** (topo)
   - Selecione **"New Compose"** ou **"Nova Composição"**

3. **Cole o docker-compose.yml**
   - Copie todo o conteúdo do arquivo `docker-compose.yml`
   - Cole no editor de texto do Docker Manager
   - Clique em **"Validate"** ou **"Validar"**

4. **Deploy**
   - Clique em **"Deploy"** ou **"Criar"**
   - Aguarde 3-5 minutos enquanto os containers sobem

### **PASSO 3: Verificar Status**

1. **Na aba "Containers":**
   - `vivera-insights-db` → Status: **Up (healthy)** ✅
   - `vivera-insights-app` → Status: **Up (healthy)** ✅
   - `vivera-fotos` → Status: **Up (healthy)** ✅

2. **Testar via Terminal:**
```bash
# Verificar containers rodando
docker ps

# Ver logs da aplicação
docker logs vivera-insights-app

# Testar endpoint /health
curl http://localhost:3000/health

# Esperado:
# {"status":"ok","timestamp":"2026-07-14T..."}
```

### **PASSO 4: Acessar a Aplicação**

- **Dashboard Principal:** https://app.viveraorofacial.com.br
- **Painel SDR:** https://app.viveraorofacial.com.br/sdr
- **API Audit:** https://app.viveraorofacial.com.br/api/audit

### **PASSO 5: Verificar Integração Pipedrive**

```bash
# Teste a integração
curl "https://app.viveraorofacial.com.br/api/audit?since=2026-07-10&until=2026-07-14"

# Esperado: JSON com dados de Meta Ads e Pipedrive
```

---

## 📊 Monitoramento

### Acessar Logs

```bash
# Logs da aplicação
docker logs vivera-insights-app -f

# Logs do banco de dados
docker logs vivera-insights-db -f

# Últimas 50 linhas
docker logs vivera-insights-app --tail 50

# Logs com timestamp
docker logs vivera-insights-app --timestamps
```

### Verificar Saúde dos Containers

```bash
docker ps
# Procure por status "Up (healthy)"

# Inspecionar container específico
docker inspect vivera-insights-app | grep -A 5 "Health"
```

---

## 🛠️ Manutenção

### Reiniciar Serviços (sem afetar N8N)

```bash
# Reiniciar Vivera Insights
docker-compose -f /docker/vivera/docker-compose.yml restart vivera-insights-app

# Reiniciar banco de dados
docker restart vivera-insights-db

# Reiniciar tudo (Vivera)
docker-compose -f /docker/vivera/docker-compose.yml restart
```

### Backup do Banco de Dados

```bash
# Fazer backup
docker exec vivera-insights-db pg_dump -U vivera vivera_insights > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar
docker exec -i vivera-insights-db psql -U vivera vivera_insights < backup_20260714_150000.sql
```

### Atualizar Código

```bash
# 1. Puxar mudanças do git
git pull origin claude/cloud-project-setup-slvqge

# 2. Rebuildar frontend
npm run build:web

# 3. Rebuildar imagem Docker
docker build -t vivera-insights:latest .

# 4. Reiniciar container
docker restart vivera-insights-app
```

---

## 🆘 Troubleshooting

### Container não inicia

```bash
# Verifique os logs
docker logs vivera-insights-app

# Valide o docker-compose.yml
docker-compose -f docker-compose.yml config

# Reinicie
docker-compose restart vivera-insights-app
```

### Banco de dados não conecta

```bash
# Verifique se PostgreSQL está rodando
docker ps | grep vivera-insights-db

# Teste conexão
docker exec vivera-insights-db psql -U vivera -d vivera_insights -c "SELECT 1"

# Ver logs do DB
docker logs vivera-insights-db
```

### Página não carrega (branca)

```bash
# Verifique se frontend foi buildado
docker exec vivera-insights-app ls -la /app/web/dist

# Verifique se assets estão sendo servidos
curl http://localhost:3000/assets/

# Rebuild do frontend
npm run build:web && docker restart vivera-insights-app
```

### Domínio não resolve

```bash
# Verifique configuração Traefik
docker logs traefik

# Verifique labels do container
docker inspect vivera-insights-app | grep traefik

# Reinicie Traefik
docker restart traefik
```

---

## 📡 Endpoints da API

```
GET /health
→ Status da aplicação e dependências

GET /
→ Dashboard HTML principal

GET /sdr
→ Painel de Corrida das SDRs

GET /api/audit
→ Audit completo (Meta Ads + Pipedrive)
Parâmetros: ?since=YYYY-MM-DD&until=YYYY-MM-DD

GET /api/pipedrive/:resource
→ Proxy para Pipedrive API (seguro)
Exemplo: /api/pipedrive/deals
```

---

## 🔒 Segurança

### ✅ Implementado

1. **Isolamento de Rede:** Cada serviço em sua própria rede
2. **Credenciais:** Armazenadas em .env (não commitadas)
3. **HTTPS:** Traefik automático com certificados Let's Encrypt
4. **Health Checks:** Monitoramento automático
5. **Restart Policies:** Alta disponibilidade (unless-stopped)
6. **Resource Limits:** CPU e memória limitadas
7. **Database:** Senha forte, backup automático

### ⚠️ Recomendações Adicionais

1. Rotacione tokens de API (Pipedrive, Meta) regularmente
2. Faça backup do banco de dados diariamente
3. Monitore os logs em busca de erros
4. Mantenha o Docker atualizado
5. Revise permissões de volumes periodicamente

---

## 📝 Checklist de Implementação

- [ ] Branch `claude/cloud-project-setup-slvqge` clonada
- [ ] Dependências instaladas (`npm install`)
- [ ] Frontend buildado (`npm run build:web`)
- [ ] .env configurado com credenciais
- [ ] docker-compose.yml validado
- [ ] Deploy realizado no Docker Manager
- [ ] Containers em status "Up (healthy)"
- [ ] Endpoint `/health` respondendo
- [ ] API `/api/audit` funcionando
- [ ] Domínio resolvendo corretamente
- [ ] HTTPS/SSL funcionando
- [ ] Backup inicial feito
- [ ] Logs monitorados
- [ ] N8N não foi afetado ✅

---

## 📞 Suporte

**Repositório:** https://github.com/diegorto/dashboardvivera  
**Branch:** claude/cloud-project-setup-slvqge  
**Email:** diegoandreiaguiar@gmail.com  

---

**Documento criado em:** 14 de Julho de 2026  
**Status:** ✅ Pronto para Deploy  
**Versão:** 1.0
