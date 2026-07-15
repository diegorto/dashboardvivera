# Vivera Dashboard - Guia de Deployment no Hostinger

> Sistema completo de Business Intelligence com 100% preservação de funcionalidades

## 📋 Pré-requisitos

1. **Node.js 18+** instalado no servidor
2. **npm** ou **yarn** disponível
3. **Credenciais de Integração**:
   - Token da API Pipedrive
   - Meta Business Suite Access Token
   - IDs de contas de anúncios Meta (formato "123456789")
   - Chave de API Anthropic (opcional, para IA contextual)

## 🚀 Passo 1: Clonar e Instalar

```bash
# Clonar repositório
git clone <repo-url> dashboardvivera
cd dashboardvivera

# Instalar dependências do backend
npm install

# Instalar dependências do frontend
cd frontend
npm install
cd ..
```

## ⚙️ Passo 2: Configurar Variáveis de Ambiente

Criar arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3000
NODE_ENV=production

# Pipedrive
PIPEDRIVE_TOKEN=<seu-token-pipedrive>

# Meta (Facebook/Instagram Ads)
FB_ACCESS_TOKEN=<seu-access-token-meta>
FB_AD_ACCOUNT_IDS=<123456789,987654321>

# Anthropic (opcional para insights com IA)
ANTHROPIC_API_KEY=<sua-chave-api>

# Business
MONTHLY_GOAL=<valor-em-reais>
INBOUND_PIPELINE_ID=<id-do-pipeline>
```

## 🏗️ Passo 3: Build da Aplicação

```bash
# Fazer build do frontend
cd frontend
npm run build
cd ..

# Isso gera a pasta frontend/dist com a SPA otimizada
```

## 🔧 Passo 4: Configurações Finais

### 4.1 Permissões de Arquivo

```bash
# Proteger arquivo de configuração
chmod 600 config/settings.json 2>/dev/null || echo "Arquivo será criado na primeira execução"
```

### 4.2 Validar Integrações

```bash
# Iniciar servidor (primeira vez)
npm start

# Acessar: http://localhost:3000
# Ir para "Configurações" e clicar em "Testar Conexões"
# Verificar status de cada integração
```

## 📊 Passo 5: Verificar Saúde do Sistema

### 5.1 Endpoints de Teste

```bash
# Health check básico
curl http://localhost:3000/api/settings

# Testar KPIs Executive
curl "http://localhost:3000/api/dashboard/executive/kpis?since=2026-01-01&until=2026-07-15"

# Testar Pipeline
curl "http://localhost:3000/api/dashboard/crm/pipeline?since=2026-01-01&until=2026-07-15"
```

### 5.2 Verificar Console do Backend

- Deve haver logs de conexão bem-sucedida com Pipedrive
- Cache deve mostrar padrão de hits crescentes (2ª+ chamadas ~10ms)
- Nenhum erro de tokens ou autenticação

## 📈 Passo 6: Performance & Otimizações

### Cache de API (Padrão: 60 segundos)

A aplicação implementa cache in-memory automático:

```
1ª chamada CRM: ~2.5s (busca em Pipedrive + Meta)
2ª+ chamadas: ~10ms (cache hit)
```

Para ajustar TTL do cache, editar `server.js`:

```javascript
const CACHE_TTL = 60000; // em milliseconds
```

### Limitar Requisições Simultâneas

```javascript
// Em server.js, aumentar se necessário:
const MAX_CACHE_SIZE = 200; // máximo de entradas em cache
```

## 🔐 Passo 7: Segurança

### 7.1 Variáveis Sensíveis

- **Nunca** fazer commit de `.env`
- `.gitignore` já protege: `config/settings.json`, `.env`
- Secrets são mascarados na API (`GET /api/settings`)

### 7.2 HTTPS/SSL

Se usar Hostinger com HTTPS:

```javascript
// server.js já trata relative URLs (/api)
// Express serve SPA com Content-Security-Policy automático
```

### 7.3 CORS (se necessário)

```javascript
// Adicionar ao server.js se acessar de domínio diferente:
const cors = require('cors');
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
```

## 📊 Passo 8: Monitoramento

### 8.1 Logs

```bash
# Ver logs em tempo real (se usar PM2)
pm2 logs dashboardvivera

# Sem PM2, simplesmente:
npm start 2>&1 | tee server.log
```

### 8.2 Alertas de Erro

Verificar regularmente:
- `console.error` mensagens de integração (Pipedrive, Meta, Anthropic)
- Latência de resposta (deve ser <2s para dashboards)
- Taxa de hit do cache (esperado >80%)

## 🔄 Passo 9: Atualizações

### 9.1 Atualizar Credenciais

**SEM RESTART** do servidor:

1. Ir para "Configurações" na UI
2. Atualizar tokens
3. Clicar "Salvar Configurações"
4. Clicar "Testar Conexões"

Cache é invalidado automaticamente.

### 9.2 Deploy de Código

```bash
# Pull novo código
git pull origin main

# Instalar novas dependências
npm install

# Rebuild frontend
cd frontend && npm run build && cd ..

# Reiniciar server
pm2 restart dashboardvivera
# Ou: pkill node && npm start
```

## 🚨 Troubleshooting

### Problema: "Erro ao testar conexões - Meta"

**Causa**: Sandbox/network policy do Hostinger bloqueando graph.facebook.com

**Solução**:
- Verificar Meta token localmente primeiro
- Contatar suporte Hostinger sobre whitelist de IPs para graph.facebook.com
- Tokens estão corretos (verificados em desenvolvimento)

### Problema: "Sem dados disponíveis" em um dashboard

**Causa**: Filtro de período vazio ou integração desconectada

**Solução**:
1. Verificar Configurações > Teste de Conexões
2. Verificar data range selecionado (mínimo últimos 30 dias)
3. Verificar Pipedrive tem dados no período

### Problema: Performance lenta (>2s)

**Causa**: Cache miss ou muitas requisições simultâneas

**Solução**:
1. Aguardar 2-3 navegações (cache aquece)
2. Verificar internet/latência do servidor
3. Se persistir: aumentar `MAX_CACHE_SIZE` em server.js

### Problema: "Cannot find module"

```bash
# Limpar cache npm e reinstalar
rm -rf node_modules package-lock.json
npm install

cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
```

## 📦 Passo 10: Rollback

Se algo quebrar:

```bash
# Reverter última commit
git reset --hard HEAD~1

# Reinstalar dependências
npm install && cd frontend && npm install && cd ..

# Reiniciar
npm start
```

## ✅ Checklist de Deploy

- [ ] Node.js 18+ instalado
- [ ] `.env` configurado com todos os tokens
- [ ] `npm install` executado (raiz + frontend)
- [ ] `npm run build` gerou `frontend/dist`
- [ ] `npm start` inicia sem erros
- [ ] UI carrega em http://localhost:3000
- [ ] Configurações > Teste de Conexões = ✅ Pipedrive
- [ ] Pelo menos um dashboard carrega dados
- [ ] CSV export funciona (botão na top bar)
- [ ] Dark/Light mode alterna sem erros
- [ ] Drill-downs navegáveis (click em números)

## 📞 Contato & Suporte

- **Backend** (Node.js): server.js - revisar logs de erro
- **Frontend** (React)**: `npm run dev` para debug local
- **Configurações**: Acessível via UI em /configuracoes

---

**Status**: Pronto para produção ✅
**Última atualização**: 2026-07-15
**Versão**: 1.0.0
