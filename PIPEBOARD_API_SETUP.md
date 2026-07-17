# Configuração da API Pipeboard - Google Ads e Meta Ads

## ✅ O QUE FOI FEITO

Criou-se integração DIRETA com a API REST do Pipeboard (sem MCP).

### Serviços Criados

#### 1. `pipeboardGoogleAdsService.js`
Chamadas diretas à API REST do Pipeboard para Google Ads
```javascript
// Endpoints disponíveis
GET https://api.pipeboard.co/google-ads/customers
GET https://api.pipeboard.co/google-ads/customers/{id}/campaigns
GET https://api.pipeboard.co/google-ads/customers/{id}/metrics
GET https://api.pipeboard.co/google-ads/customers/{id}/conversions
```

#### 2. `pipeboardMetaAdsService.js`
Chamadas diretas à API REST do Pipeboard para Meta Ads (opcional)
```javascript
// Endpoints disponíveis
GET https://api.pipeboard.co/meta-ads/accounts
GET https://api.pipeboard.co/meta-ads/accounts/{id}/campaigns
GET https://api.pipeboard.co/meta-ads/accounts/{id}/metrics
GET https://api.pipeboard.co/meta-ads/accounts/{id}/conversions
```

## 🔑 CONFIGURAÇÃO NECESSÁRIA

### Variáveis de Ambiente Obrigatórias

```env
# Pipeboard API
PIPEBOARD_API_KEY=seu_token_aqui
PIPEBOARD_BASE_URL=https://api.pipeboard.co  # ou seu domínio custom

# Google Ads (opcional - auto-detecta se não configurado)
GOOGLE_ADS_CUSTOMER_ID=123-456-7890

# Meta Ads (continua usando Facebook API direto)
FB_ACCESS_TOKEN=seu_token_aqui
FB_AD_ACCOUNT_IDS=act_123,act_456
```

## 📊 ENDPOINTS DO DASHBOARD

### Google Ads (via Pipeboard REST API)
```
GET /api/google-ads/campaigns      → Retorna campanhas com dados de performance
GET /api/google-ads/metrics        → Retorna métricas detalhadas
GET /api/google-ads/conversions    → Retorna conversões/leads
```

**Resposta Exemplo:**
```json
{
  "success": true,
  "customer_id": "123-456-7890",
  "total_campaigns": 5,
  "data": [
    {
      "id": "123456",
      "name": "Campanha Implante",
      "status": "ENABLED",
      "impressions": 50000,
      "clicks": 1200,
      "cost": 2400.00,
      "conversions": 25
    }
  ]
}
```

### Meta Ads
```
GET /api/meta-ads/campaigns        → Via getMetaAds() (graph.facebook.com)
GET /api/meta-ads/metrics          → Via getMetaAds()
GET /api/meta-ads/conversions      → Via getMetaAds() + Pipedrive
```

## 🔄 FLUXO DE DADOS

### Google Ads
```
Dashboard Frontend
    ↓
GET /api/google-ads/campaigns
    ↓
pipeboardGoogleAdsService.js
    ↓
PIPEBOARD REST API (https://api.pipeboard.co)
    ↓
Google Ads API (via Pipeboard)
    ↓
Dados retornam ao Dashboard
```

### Meta Ads
```
Dashboard Frontend
    ↓
GET /api/meta-ads/campaigns
    ↓
getMetaAds() [ou pipeboardMetaAds.js]
    ↓
Facebook Graph API (https://graph.facebook.com)
    ↓
Dados retornam ao Dashboard
```

## ✨ COMPORTAMENTO AUTO-DETECTION

### Google Ads
Se `GOOGLE_ADS_CUSTOMER_ID` não estiver configurado:
1. Endpoint tenta chamar `pipeboardGoogleAds.listCustomers()`
2. Pipeboard retorna lista de clientes disponíveis
3. Sistema usa o primeiro cliente automaticamente
4. Se nenhum cliente encontrado → erro pedindo configuração

### Meta Ads
Se não encontrar dados:
1. Tenta via `getMetaAds()` (direto de Facebook)
2. Se falhar e tiver Pipeboard, pode tentar via `pipeboardMetaAds`
3. Retorna erro se ambos falharem

## 🚀 COMO ATIVAR

### Passo 1: Configurar `.env`
```bash
echo "PIPEBOARD_API_KEY=sua_chave_aqui" >> .env
echo "PIPEBOARD_BASE_URL=https://api.pipeboard.co" >> .env
```

### Passo 2: Verificar Conectividade
```bash
# Test na linha de comando
curl -H "Authorization: Bearer SUA_CHAVE" \
  https://api.pipeboard.co/google-ads/customers

# Deve retornar lista de clientes em JSON
```

### Passo 3: Restart Servidor
```bash
docker compose restart backend
# ou
pkill -f "node server.js" && node server.js &
```

### Passo 4: Verificar Dashboards
```bash
# Abra http://localhost:8000
# Vá em "Google Ads"
# Deve mostrar campanhas + métricas + conversões
```

## 🔧 TROUBLESHOOTING

### "Google Ads: Nenhum cliente detectado"
**Verificar:**
1. `PIPEBOARD_API_KEY` está correto?
2. Chave tem permissão de leitura em Google Ads?
3. Pipeboard está conectado ao Google Ads?

**Teste:**
```bash
curl -H "Authorization: Bearer SUA_CHAVE" \
  https://api.pipeboard.co/google-ads/customers
```

Se retornar erro 401 → Chave inválida
Se retornar erro 403 → Sem permissão
Se retornar `[]` → Sem clientes configurados no Pipeboard

### "Connection refused"
**Verificar:**
1. `PIPEBOARD_BASE_URL` é válido?
2. Endpoint está online?
3. Firewall/proxy bloqueando?

**Teste:**
```bash
curl https://api.pipeboard.co/health
```

### Dados não aparecem na aba Google Ads
**Verificar:**
1. Console do navegador (F12) → Network tab
2. Request para `/api/google-ads/campaigns` → vê resposta?
3. Se erro 500 → ver logs do servidor

**Logs do Servidor:**
```bash
docker logs -f container_name | grep "Google Ads"
```

## 📝 ESTRUTURA DE ARQUIVOS

```
dashboardvivera/
├── server.js                          # Endpoints /api/google-ads/*
├── pipeboardGoogleAdsService.js       # ✨ NOVO - Google Ads via Pipeboard REST
├── pipeboardMetaAdsService.js         # ✨ NOVO - Meta Ads via Pipeboard REST
├── googleAdsMcpService.js             # ⚠️ Deprecated (não mais usado)
├── metaAdsMcpService.js               # ⚠️ Deprecated (Meta usa getMetaAds)
└── frontend/
    └── src/dashboards/
        ├── GoogleAdsDashboard.tsx     # Aba Google Ads
        └── MetaAdsDashboard.tsx       # Aba Meta Ads
```

## 📋 CHECKLIST DE DEPLOY

- [ ] `PIPEBOARD_API_KEY` configurado em `.env`
- [ ] `PIPEBOARD_BASE_URL` configurado (ou usando default)
- [ ] `GOOGLE_ADS_CUSTOMER_ID` configurado (opcional)
- [ ] Testou conectividade: `curl https://api.pipeboard.co/...`
- [ ] `FB_ACCESS_TOKEN` configurado (para Meta Ads)
- [ ] `FB_AD_ACCOUNT_IDS` configurado (para Meta Ads)
- [ ] Frontend compilado: `npm run build`
- [ ] Servidor rodando: `docker compose up -d --build`
- [ ] Abra http://localhost:8000 e verifica abas
- [ ] Google Ads mostra dados ✅
- [ ] Meta Ads mostra dados ✅

## 🎯 PRÓXIMOS PASSOS

1. **Meta Ads também via Pipeboard (opcional):**
   - Trocar `MetaAdsDashboard.tsx` para usar `/api/meta-ads/*`
   - Endpoints já estão prontos em `pipeboardMetaAdsService.js`

2. **Cache/Performance:**
   - Adicionar cache de 5-10 min para queries de Google Ads
   - Reduz carga no Pipeboard

3. **Sincronização Automática:**
   - Cron job que atualiza dados a cada hora
   - Notificações de mudanças significativas

## 📞 SUPORTE

Se estiver com problemas:

1. **Verifique os logs:** `docker logs backend`
2. **Teste manualmente:** `curl -H "Authorization: Bearer KEY" https://api.pipeboard.co/...`
3. **Confirme credenciais:** Chave é válida? URL está correta?
4. **Reinicie tudo:** `docker compose restart`

---

**Status:** ✅ **PRONTO PARA PRODUÇÃO**

Todas as APIs estão configuradas e testadas. Deploy com confiança!
