# Commercial Dashboard - Proposta de Estrutura

**Status**: ⏳ Aguardando aprovação  
**Fase**: 4  
**Branch**: `claude/reinice-ren84r`

---

## 📋 Objetivo

Dashboard de análise comercial focado em conversão de leads em vendas. Rastreia performance de vendas por SDR/Profissional/Recepção e identifica gargalos no funil.

---

## 🏗️ Estrutura Proposta

### Seção 1: Summary KPIs (5 Cards - topo)
```
[Leads] [Qualificados] [Agendados] [Compareceram] [Compraram]
```
- Todos com número grande + tendência
- Clicáveis para drill-down

### Seção 2: Gráfico de Funil (linha completa do lead até venda)
```
Leads → Qualificados → Agendados → Compareceram → Compraram → % Conversão
```
- Mostra quantidade em cada estágio
- Mostra % de conversão entre etapas

### Seção 3: Tabela de Performance por Profissional
```
Profissional | Leads | Qualif. | Agendados | Compareceu | Comprou | Taxa Conv. | Ticket
```
- Ordenável por coluna
- Expandível por linha para detalhe

### Seção 4: Motivos de Perda (Top 5)
```
Motivo | Quantidade | % do Total
```
- Simples e direto
- Ajuda identificar por que leads não viram vendas

---

## 📊 KPIs Específicos

### Summary Cards (5)
| KPI | Fonte | Cálculo |
|-----|-------|---------|
| Leads | Pipedrive | COUNT(deals where status='lead') |
| Qualificados | Pipedrive | COUNT(deals where status='qualified') |
| Agendados | Pipedrive | COUNT(appointments scheduled) |
| Compareceram | Pipedrive | COUNT(appointments attended) |
| Compraram | Pipedrive | COUNT(deals where status='won') |

### Tabela de Performance (11 colunas)
| Métrica | Fonte | Cálculo |
|---------|-------|---------|
| Profissional | Pipedrive | user.name |
| Leads | Pipedrive | COUNT(owned by user) |
| Qualificados | Pipedrive | COUNT(qualified by user) |
| Agendados | Pipedrive | COUNT(appointments by user) |
| Compareceram | Pipedrive | COUNT(attended by user) |
| Compraram | Pipedrive | COUNT(won deals by user) |
| Taxa Conversão | Calculado | (Compraram / Leads) × 100 |
| Ticket Médio | Pipedrive | AVG(deal.value) |
| Tempo até Venda | Calculado | AVG(created_at to won_at) em dias |
| Tempo 1º Contato | Calculated | AVG(created_at to first_activity) em horas |
| Trend | Calculado | (Mês atual vs mês anterior) % |

### Funil
| Estágio | Quantidade | % da Etapa Anterior |
|---------|-----------|-------------------|
| Leads | SUM | 100% |
| Qualificados | SUM | X% de Leads |
| Agendados | SUM | X% de Qualificados |
| Compareceram | SUM | X% de Agendados |
| Compraram | SUM | X% de Comparecidos |

### Motivos de Perda (Top 5)
| Motivo | Quantidade | % do Total |
|--------|-----------|-----------|
| [Auto-populate] | [Auto-populate] | [Auto-populate] |

---

## 🎨 Componentes

### Reutilizados (sem criar novo)
- ✅ **KPICard** (5 cards do topo)
- ✅ **Layout** (Sidebar + Header)
- ✅ **BarChart/LineChart** (Funil visual)
- ✅ **Tabela** (Performance por profissional)

### Novos Componentes
- ❌ **NENHUM** (mantém simplicidade)

---

## 🔌 Fluxo de Dados

```
User seleciona período (filtro global)
    ↓
CommercialDashboard detecta mudança
    ↓
CommercialDashboardService.getFullCommercialDashboard(since, until)
    ↓
Parallel API calls:
  - GET /api/dashboard/commercial/kpis
  - GET /api/dashboard/commercial/conversions
  - GET /api/dashboard/commercial/reasons
    ↓
Backend consulta Pipedrive:
  - Busca deals por período
  - Agrupa por profissional/SDR
  - Calcula conversão, ticket, tempo
  - Extrai motivos de perda
    ↓
Frontend renderiza com dados reais
```

---

## 🔗 Backend Endpoints (novos)

### 1. GET /api/dashboard/commercial/kpis
```json
{
  "success": true,
  "range": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" },
  "data": {
    "leads": 0,
    "qualified": 0,
    "scheduled": 0,
    "attended": 0,
    "purchased": 0
  }
}
```

### 2. GET /api/dashboard/commercial/conversions
```json
{
  "success": true,
  "range": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" },
  "data": [
    {
      "id": "user-id",
      "name": "Nome Profissional",
      "leads": 0,
      "qualified": 0,
      "scheduled": 0,
      "attended": 0,
      "purchased": 0,
      "conversionRate": 0,
      "avgTicket": 0,
      "timeToSale": 0,
      "timeFirstContact": 0,
      "trend": 0
    }
  ]
}
```

### 3. GET /api/dashboard/commercial/reasons
```json
{
  "success": true,
  "range": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" },
  "data": [
    {
      "reason": "Motivo de perda",
      "quantity": 0,
      "percentage": 0
    }
  ]
}
```

---

## 📝 Frontend Services

### CommercialDashboardService
```typescript
- getCommercialKPIs(since, until)
- getConversionsByProfessional(since, until)
- getLossReasons(since, until)
- getFullCommercialDashboard(since, until) → paralelo
```

### Tipos TypeScript
```typescript
CommercialKPIs
ConversionRow
LossReason
```

---

## ⚙️ Implementação

**Arquivos a criar/alterar**:
1. `backend/server.js` - 3 endpoints novos
2. `frontend/src/services/commercialDashboardService.ts` - Service layer
3. `frontend/src/dashboards/CommercialDashboard.tsx` - Componente refatorado
4. `docs/screens/commercial-dashboard.md` - Documentação

**Reutilizações**:
- getMetaAds() → não usado (dados vêm só de Pipedrive)
- getPipedriveDeals() → existente, adapt for commercial funnel

---

## ✅ Checklist de Aprovação

- [ ] Layout está OK?
- [ ] KPIs estão corretos?
- [ ] Fonte de dados (Pipedrive) está OK?
- [ ] Tabela de performance por profissional faz sentido?
- [ ] Motivos de perda é útil?
- [ ] Alguma coisa a adicionar/remover/mudar?

---

**Aguardando seu feedback para prosseguir com a implementação.**
