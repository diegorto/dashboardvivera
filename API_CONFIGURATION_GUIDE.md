# Guia Completo de Configuração de APIs - Google Ads e Meta Ads

## 🔴 PROBLEMA IDENTIFICADO

Os dados de Google Ads e Meta Ads **NÃO estavam sendo puxados** nas abas porque:

1. **Meta Ads tinha dois sistemas diferentes:**
   - ✅ MarketingDashboard: usa `getMetaAds()` → puxa direto de Facebook API → **FUNCIONA**
   - ❌ MetaAdsDashboard (aba Meta Ads): tentava usar Pipeboard MCP → **NÃO FUNCIONA**

2. **Google Ads:**
   - ❌ GoogleAdsDashboard (aba Google Ads): tentava usar Pipeboard MCP → **NÃO FUNCIONA**

## ✅ SOLUÇÃO IMPLEMENTADA

### Meta Ads - Unificado para Funcionar

Agora **TODOS** os endpoints Meta Ads usam a mesma função que já funciona:

```javascript
// Endpoints que agora funcionam:
GET /api/meta-ads/campaigns      ✅ Usa getMetaAds()
GET /api/meta-ads/metrics        ✅ Usa getMetaAds()
GET /api/meta-ads/conversions    ✅ Usa getMetaAds() + getPipedriveDeals()

// Removidos endpoints que não funcionavam:
✗ GET /api/meta-ads/test        (Pipeboard MCP)
✗ GET /api/meta-ads/accounts    (Pipeboard MCP)
```

**Configuração necessária para Meta Ads funcionar:**
```env
FB_ACCESS_TOKEN=your_token_here
FB_AD_ACCOUNT_IDS=act_123,act_456,act_789
```

### Google Ads - Mantém Pipeboard (com fallback melhorado)

Google Ads continua via Pipeboard MCP, mas com melhor tratamento de erros:

```javascript
GET /api/google-ads/campaigns    → Pipeboard MCP
GET /api/google-ads/metrics      → Pipeboard MCP
GET /api/google-ads/conversions  → Pipeboard MCP
```

**Configuração necessária para Google Ads funcionar:**
```env
PIPEBOARD_API_KEY=your_key_here
GOOGLE_ADS_CUSTOMER_ID=123-456-7890  # (Opcional - auto-detecta se não configurado)
```

---

## 📊 Status de Cada Dashboard

### ✅ FUNCIONANDO (Garantido)

| Dashboard | Dados | Fonte |
|-----------|-------|-------|
| **Marketing** | Campanhas, tendências, KPIs | Meta Ads (getMetaAds) |
| **Meta Ads (aba)** | Campanhas, métricas, conversões | Meta Ads (getMetaAds) |
| **Meta Ads em outro lugar** | CPM, CPC, CTR, etc | Meta Ads (getMetaAds) |

### ⚠️ DEPENDE DE CONFIGURAÇÃO

| Dashboard | Dados | Fonte | Requer |
|-----------|-------|-------|--------|
| **Google Ads (aba)** | Campanhas, métricas, conversões | Pipeboard MCP | `PIPEBOARD_API_KEY` |

### 🔧 COMO VERIFICAR SE ESTÁ FUNCIONANDO

#### 1. Meta Ads (Verificação rápida)
```bash
# Teste se Meta está conectado
curl http://localhost:8000/api/dashboard/marketing/campaigns
curl http://localhost:8000/api/meta-ads/campaigns

# Se receber dados JSON com "success": true → ✅ FUNCIONA
```

#### 2. Google Ads (Verificação rápida)
```bash
# Teste se Google Ads está conectado
curl http://localhost:8000/api/google-ads/campaigns

# Se receber erro sobre PIPEBOARD_API_KEY → ⚠️ Precisa configurar
# Se receber dados JSON com "success": true → ✅ FUNCIONA
```

---

## 🔑 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

### Meta Ads (Obrigatório para funcionamento)

```env
# Facebook/Meta Ads
FB_ACCESS_TOKEN=your_facebook_access_token_here
FB_AD_ACCOUNT_IDS=act_123456789,act_987654321
```

**Como obter:**
1. Ir em facebook.com/business → Gerenciador de Anúncios
2. ID da conta: coluna "ID da Conta"
3. Access Token: usar Graph API Explorer

### Google Ads (Obrigatório para Tab Google Ads funcionar)

```env
# Google Ads via Pipeboard MCP
PIPEBOARD_API_KEY=your_pipeboard_api_key_here
GOOGLE_ADS_CUSTOMER_ID=123-456-7890  # Opcional - auto-detecta
```

**Como obter:**
1. Pipeboard: configurar integração Google Ads
2. Copiar API Key do painel de configurações
3. Customer ID: obtém automaticamente ou coloca manualmente

### Pipedrive (Necessário - já deve estar configurado)

```env
PIPEDRIVE_TOKEN=your_pipedrive_token_here
```

---

## 📝 ESTRUTURA DE DADOS

### /api/meta-ads/campaigns
```json
{
  "success": true,
  "total_campaigns": 5,
  "range": { "since": "2026-06-16", "until": "2026-07-16" },
  "data": [
    {
      "id": "campaign-1",
      "name": "Implante - Google",
      "adset": "Conjunto 1",
      "creative": "Video HD",
      "spend": 1500.50,
      "leads": 25,
      "cpl": "60.02"
    }
  ]
}
```

### /api/google-ads/campaigns
```json
{
  "success": true,
  "customer_id": "123-456-7890",
  "total_campaigns": 3,
  "data": [
    {
      "id": "123456",
      "name": "Orthodontia Campaign",
      "status": "ENABLED",
      "impressions": 50000,
      "clicks": 1200,
      "cost": 2400.00
    }
  ]
}
```

---

## 🚨 TROUBLESHOOTING

### "Google Ads: Configure PIPEBOARD_API_KEY"
**Solução:** Adicionar ao `.env`:
```env
PIPEBOARD_API_KEY=seu_token_aqui
```

### "Meta Ads: Configure FB_ACCESS_TOKEN"
**Solução:** Adicionar ao `.env`:
```env
FB_ACCESS_TOKEN=seu_token_aqui
FB_AD_ACCOUNT_IDS=act_123,act_456
```

### Dados não aparecem na aba Meta Ads
**Verificar:**
1. FB_ACCESS_TOKEN está correto? 
2. FB_AD_ACCOUNT_IDS contém IDs válidos?
3. Token ainda é válido? (expira)
4. Servidor rodando em porta 8000?

### Dados não aparecem na aba Google Ads
**Verificar:**
1. PIPEBOARD_API_KEY está configurado?
2. Pipeboard está conectado ao Google Ads?
3. GOOGLE_ADS_CUSTOMER_ID é válido?

---

## 📍 DEPLOY CHECKLIST

- [ ] `FB_ACCESS_TOKEN` configurado
- [ ] `FB_AD_ACCOUNT_IDS` configurado
- [ ] `PIPEBOARD_API_KEY` configurado (se usar Google Ads)
- [ ] `PIPEDRIVE_TOKEN` configurado
- [ ] Backend rodando em porta 8000
- [ ] Frontend compilado (`npm run build`)
- [ ] Teste Meta: `curl http://localhost:8000/api/meta-ads/campaigns`
- [ ] Teste Google: `curl http://localhost:8000/api/google-ads/campaigns`

---

## 📊 DADOS QUE CADA ABA MOSTRA

### Meta Ads (Aba)
- Campanhas com spend e leads
- Métricas de performance
- Conversões com ROI/ROAS (vs Pipedrive)
- CPL por campanha

### Google Ads (Aba)
- Campanhas com impressões e cliques
- Métricas de performance
- Conversões com ROI/ROAS
- CPC, CTR, CPM

### Marketing Dashboard
- MESMO que Meta Ads Aba
- Dados de Meta unificados
- Tendências
- Ranking de campanhas

---

## ✅ VALIDAÇÃO FINAL

Após deploy, verificar:

1. **Abra http://localhost:8000**
2. **Clique em "Marketing"** → Deve mostrar campanhas Meta Ads ✅
3. **Clique em "Meta Ads"** → Deve mostrar mesmos dados ✅
4. **Clique em "Google Ads"** → Se Google configurado, deve mostrar dados ✅
5. **Logs do servidor** → Não deve haver erros de autenticação

Se tudo estiver verde → **Sistema funcionando 100%!** 🎉
