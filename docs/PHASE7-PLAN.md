# Phase 7: IA Executive - Implementation Plan

**Status**: 🟡 PLANNING  
**Target Start**: After Phase 6 sign-off  
**Target Completion**: Week of July 28  
**Branch**: `claude/reinice-ren84r`

---

## 📋 Overview

Phase 7 focuses on adding **intelligent context** to dashboards using Claude API. IA should enhance decision-making without replacing existing visualizations (per CLAUDE.md rule #5).

### Key Principle
> "IA nunca substitui - IA apenas explica os dados, nunca remove visualizações"

---

## 🎯 Phase 6 Prerequisites (Must Complete First)

Before starting Phase 7, complete these Phase 6 fixes:

### Immediate (Day 1)
- [ ] **Verify Data Consistency** - Confirm Executive Dashboard appointment values sync with Agenda Dashboard
  - Status: ✅ VERIFIED - Both use `getPipedriveActivities()` - NO FIX NEEDED
  - Evidence: Lines 512-513 vs 698-699 in server.js both reference same function
  
### High Priority (This Week)
- [ ] **Test All 4 Dashboards** - Manual E2E testing on production branch
  - [ ] WhatsApp Dashboard - verify alert shows when integration pending
  - [ ] Professionais - test sorting on all 9 columns
  - [ ] Agenda - test day filter (Todos/Hoje/Amanhã)
  - [ ] Commercial - verify funnel percentages and loss reasons
  - [ ] Run: `npm run build && npm start`

- [ ] **Verify API Endpoints** - Confirm all 4 dashboard endpoints respond
  ```bash
  curl http://localhost:3001/api/dashboard/whatsapp/kpis
  curl http://localhost:3001/api/dashboard/professionals/kpis
  curl http://localhost:3001/api/dashboard/agenda/kpis
  curl http://localhost:3001/api/dashboard/commercial/kpis
  ```

### Before Deployment
- [ ] Update DEPLOY.md with Phase 6 specifics (storage for Tintim integration)
- [ ] Document Anthropic API requirements in SETTINGS.md

---

## 📊 Phase 7 Implementation Roadmap

### Week 1: IA Infrastructure

#### Task 1.1: Create AIService Layer
**Goal**: Centralized AI API calls with caching

**Implementation**:
```typescript
// frontend/src/services/aiService.ts
class AIService {
  // Analyze executive KPIs
  async analyzeExecutiveMetrics(kpis: ExecutiveKPIs): Promise<AIInsight[]>
  
  // Analyze commercial funnel  
  async analyzeCommercialFunnel(funnel: FunnelStage[]): Promise<AIInsight[]>
  
  // Analyze professional rankings
  async analyzeProfessionalPerformance(pros: ProfessionalRanking[]): Promise<AIInsight[]>
  
  // Generate narrative summary
  async generateDashboardNarrative(dashboard: string, data: any): Promise<string>
}
```

**Dependencies**:
- `@anthropic-ai/sdk` (already installed)
- Existing `anthropicApiKey` from settings.json

**Cache Strategy**:
- Backend cache: 5 minutes TTL (insights stable)
- Frontend: Zustand store for last query
- Invalidate on period change

**Effort**: 4-6 hours  
**Files Changed**: +1 (aiService.ts), modified server.js (+2 endpoints)

---

#### Task 1.2: Backend IA Endpoints

**Endpoints to Create**:
```
POST /api/ai/analyze/executive
  Body: { kpis: ExecutiveKPIs, dateRange: DateRange }
  Response: { insights: AIInsight[], narrative: string }

POST /api/ai/analyze/commercial
  Body: { funnel: FunnelStage[], conversions: ProfConversion[] }
  Response: { insights: AIInsight[], lossAnalysis: string }

POST /api/ai/analyze/professionals  
  Body: { ranking: ProfessionalRanking[] }
  Response: { topPerformers: string, improvementAreas: string }

POST /api/ai/analyze/agenda
  Body: { kpis: AgendaKPIs, appointments: Appointment[] }
  Response: { insights: AIInsight[], recommendations: string }
```

**Error Handling**:
- If API key missing → return empty insights with warning
- If rate limited → return cached previous insights
- If timeout → return generic insights

**Effort**: 6-8 hours  
**Files Changed**: +server.js routes

---

### Week 2: Frontend IA Components

#### Task 2.1: AIInsightCard Component

**Component API**:
```typescript
<AIInsightCard
  title="Tendência"
  insight="Receita acima da meta em 12%"
  trend="up"  // up | down | stable
  recommendation="Manter estratégia comercial"
  severity="info"  // low | medium | high
/>
```

**Styling**:
- Green border for positive (up)
- Red border for negative (down)  
- Blue for stable
- Icon indicators (📈/📉/➡️)
- Recommendation text with action color

**Effort**: 2-3 hours  
**Files Changed**: +1 component

---

#### Task 2.2: IA Panel Component

**Component API**:
```typescript
<AIPanel
  loading={isAnalyzing}
  insights={insights}
  narrative={narrative}
  onRefresh={() => reanalyze()}
/>
```

**Features**:
- 3-5 insights displayed as cards
- Narrative paragraph below
- Refresh button (re-analyze with same data)
- Loading spinner during analysis
- Empty state message

**Effort**: 3-4 hours  
**Files Changed**: +1 component

---

### Week 3: Integration with Existing Dashboards

#### Task 3.1: ExecutiveDashboard IA Integration
**Location**: Add AI Panel below Funnel chart  
**Data Passed**: Full KPIs + chart data  
**Prompts**: 
```
"Analise esses KPIs de receita, meta e previsão. Que decisões o executivo deve tomar?"
"Identifique anomalias: qual métrica está fora do padrão esperado?"
"Recomendações para atingir a meta de {monthlyGoal}?"
```

**Effort**: 2-3 hours  
**Files Changed**: ExecutiveDashboard.tsx

---

#### Task 3.2: CommercialDashboard IA Integration
**Location**: Add AI Panel below loss reasons  
**Data Passed**: Funnel + conversions + loss reasons  
**Prompts**:
```
"Qual etapa do funil está com mais gargalo? Por quê?"
"Recomendações para melhorar taxa de conversão para {targetRate}%?"
"Os profissionais têm performance consistente? Quem precisa de treinamento?"
```

**Effort**: 2-3 hours  
**Files Changed**: CommercialDashboard.tsx

---

#### Task 3.3: ProfessionalsDashboard IA Integration
**Location**: Add AI Panel beside ranking table  
**Data Passed**: Ranking + revenue + conversion data  
**Prompts**:
```
"Identifique top 3 performers. O que eles fazem diferente?"
"Quem está com performance abaixo do esperado?"
"Recomendações de mentoring para cada profissional?"
```

**Effort**: 2-3 hours  
**Files Changed**: ProfessionalsDashboard.tsx

---

#### Task 3.4: Agenda Dashboard IA Integration
**Location**: Add AI Panel below KPI cards  
**Data Passed**: KPIs + appointments list  
**Prompts**:
```
"Taxa de conclusão está abaixo de 80%? Qual a causa provável?"
"Padrões de no-show - quais horas/dias têm mais cancelamentos?"
"Recomendações para melhorar presença?"
```

**Effort**: 2-3 hours  
**Files Changed**: AgendaDashboard.tsx

---

#### Task 3.5: Marketing Dashboard IA Integration (if exists in Phase 6)
**Location**: Add AI Panel below ROI/ROAS charts  
**Data Passed**: Campaign metrics, ROAS, spend  
**Prompts**:
```
"Qual campanha tem melhor ROAS? Escalar essa?"
"Campanhas com baixo ROI - pausar ou otimizar?"
"Recomendações de alocação de budget?"
```

**Effort**: 2-3 hours  
**Files Changed**: MarketingDashboard.tsx

---

### Week 4: Polish & Testing

#### Task 4.1: IA Prompt Engineering
**Goal**: Fine-tune Claude prompts for business context

**Testing**:
- [ ] Test with executive (C-level language/brevity)
- [ ] Test with commercial (actionable insights)
- [ ] Test with edge cases (zero revenue, all deals lost, etc)
- [ ] Verify insights are non-obvious (not just "revenue is high")

**Prompt Variations**:
```typescript
// Based on severity of anomaly
const prompts = {
  normal: "Analise...",
  warning: "ATENÇÃO: ...", 
  critical: "CRÍTICO: ..."
}
```

**Effort**: 3-4 hours  
**Files Changed**: aiService.ts (prompt updates)

---

#### Task 4.2: Performance Optimization
- [ ] Batch API calls (combine multiple insights into one request)
- [ ] Implement concurrent request limiting (max 3 parallel)
- [ ] Add request deduplication (don't call twice for same data)
- [ ] Monitor API cost (log token usage)

**Effort**: 2-3 hours  
**Files Changed**: server.js, aiService.ts

---

#### Task 4.3: E2E Testing
- [ ] Test all 5 dashboards load AI insights
- [ ] Verify insights update when filter period changes
- [ ] Test error scenarios (API key missing, rate limit, timeout)
- [ ] Performance test (measure load time with AI)
- [ ] Validate insights quality (review Claude output)

**Effort**: 3-4 hours (manual testing)

---

## 🏗️ Technical Architecture

### Current State
```
Frontend Dashboard
  ↓ (useEffect on period change)
ServiceLayer
  ↓ (fetch KPIs)
Backend Express
  ↓ (aggregate Pipedrive data)
Pipedrive API
```

### Phase 7 Addition
```
Frontend Dashboard
  ├─ Fetch KPIs (existing)
  └─ Fetch AI Insights (NEW)
      ↓
    ServiceLayer
      ├─ getKPIs() (existing)
      └─ getAIInsights() (NEW)
        ↓
      Backend Express
        ├─ Aggregate data
        └─ Call Claude API (NEW)
          ↓
        Anthropic Claude API
          ↓
        Return: { insights[], narrative }
```

### Caching Strategy

**Frontend Cache** (Zustand):
```typescript
{
  lastAnalysis: {
    timestamp: number,
    insights: AIInsight[],
    narrative: string,
    dataHash: string
  }
}
```

**Backend Cache** (In-memory):
- Key: `ai:{dashboard}:{dataHash}`
- TTL: 5 minutes
- Eviction: LRU (max 50 entries)

**Invalidation**:
- On period change
- On data refresh
- On manual refresh button

---

## 📦 Dependencies

**Already Installed**:
- ✅ @anthropic-ai/sdk (0.111.0)
- ✅ Zustand (state for cache)
- ✅ React (for components)

**New Dependencies**: None required

---

## 📋 Detailed Task List

### Week 1
- [ ] 1.1.a Create AIService class skeleton
- [ ] 1.1.b Implement caching layer
- [ ] 1.1.c Add TypeScript interfaces for AI responses
- [ ] 1.2.a Create backend AI endpoints (structure)
- [ ] 1.2.b Implement Claude API calls
- [ ] 1.2.c Add error handling
- [ ] 1.2.d Add request logging for cost tracking

### Week 2
- [ ] 2.1.a Create AIInsightCard component
- [ ] 2.1.b Add styling (green/red/blue borders)
- [ ] 2.1.c Test with mock data
- [ ] 2.2.a Create AIPanel component
- [ ] 2.2.b Add loading state
- [ ] 2.2.c Add empty state
- [ ] 2.2.d Verify responsive design

### Week 3
- [ ] 3.1.a Add AI panel to ExecutiveDashboard
- [ ] 3.1.b Test with real data
- [ ] 3.2.a Add AI panel to CommercialDashboard
- [ ] 3.2.b Test sorting + AI together
- [ ] 3.3.a Add AI panel to ProfessionalsDashboard
- [ ] 3.3.b Test with large datasets
- [ ] 3.4.a Add AI panel to AgendaDashboard
- [ ] 3.4.b Test day filter + AI together
- [ ] 3.5.a Add AI panel to MarketingDashboard (if applicable)

### Week 4
- [ ] 4.1.a Write initial prompts for each dashboard
- [ ] 4.1.b Test edge cases
- [ ] 4.1.c Refine prompts based on output
- [ ] 4.2.a Implement batch API calls
- [ ] 4.2.b Add request deduplication
- [ ] 4.2.c Monitor token usage
- [ ] 4.3.a Manual E2E testing
- [ ] 4.3.b Document test results
- [ ] 4.3.c Fix any issues found

---

## ⚠️ Risk Mitigation

### Risk 1: Claude API Costs
- **Concern**: Unlimited API calls = expensive
- **Mitigation**: 
  - Cache insights (5 min TTL)
  - Batch requests
  - Monitor token usage
  - Implement rate limiting
- **Fallback**: If over budget, disable AI for non-execs

### Risk 2: Slow API Responses
- **Concern**: 2-5s latency from Claude = poor UX
- **Mitigation**:
  - Load AI insights asynchronously (after KPIs)
  - Show skeleton loading
  - Implement timeout (5s max, show error)
- **Fallback**: Omit AI panel if timeout

### Risk 3: Inaccurate/Biased Insights
- **Concern**: Claude might suggest bad decisions
- **Mitigation**:
  - Human review of insights quality
  - Prompts emphasize "recommendations" not "do this"
  - Always show underlying data (insights don't replace viz)
- **Fallback**: Disable if quality issues found

### Risk 4: API Key Leakage
- **Concern**: Frontend exposes API key
- **Mitigation**:
  - Keep key in backend only
  - Frontend calls `/api/ai/analyze/*` endpoints
  - No direct Claude API calls from browser
- **Current**: ✅ Already implemented (key in server.js only)

---

## 📊 Success Criteria

### Functional
- [ ] All 5 dashboards show AI insights
- [ ] Insights update when period changes
- [ ] Error handling works (graceful degradation)
- [ ] Performance < 2s additional load time
- [ ] 100% uptime (no crashes on API errors)

### Quality
- [ ] Insights are actionable (not generic)
- [ ] Insights are accurate (reviewed by domain experts)
- [ ] Tone is professional (not condescending)
- [ ] Balanced perspective (not overly optimistic/pessimistic)

### UX
- [ ] Loading state clear and brief
- [ ] Insights easily readable (short, clear)
- [ ] Refresh button works smoothly
- [ ] Mobile responsive

### Operations
- [ ] API costs documented and approved
- [ ] Token usage logged (for cost tracking)
- [ ] Fallback/graceful degradation verified
- [ ] Documentation complete

---

## 📝 Documentation Deliverables

After Phase 7, create:

1. **AI-IMPLEMENTATION.md** - Technical details of AI integration
2. **AI-PROMPTS.md** - All Claude prompts with rationale
3. **AI-TESTING.md** - Test results and quality validation
4. Update each dashboard doc with AI insights section

---

## 🚀 Deployment Checklist

- [ ] API key configured in production
- [ ] Rate limiting tested
- [ ] Caching verified
- [ ] Error handling tested
- [ ] Performance benchmarked
- [ ] Documentation updated
- [ ] Team trained on IA features
- [ ] Monitoring/alerts configured

---

## 📅 Timeline

| Week | Tasks | Owner | Status |
|------|-------|-------|--------|
| W1 (Jul 22-26) | Infrastructure & endpoints | Backend | 🟡 TODO |
| W2 (Jul 29-Aug 2) | Components & integration | Frontend | 🟡 TODO |
| W3 (Aug 5-9) | Dashboard integration | Full Stack | 🟡 TODO |
| W4 (Aug 12-16) | Polish & testing | QA | 🟡 TODO |

---

## Next Steps

1. **Review & Approve This Plan** - Get sign-off from product owner
2. **Complete Phase 6** - Finish all tests and verifications
3. **Kick-off Phase 7** - Assign developers to tasks
4. **Weekly Syncs** - Monitor progress and risks

---

**Author**: Claude Haiku 4.5  
**Branch**: claude/reinice-ren84r  
**Date**: 2026-07-15
