# Executive Dashboard - Estrutura para Aprovação

**Status**: ⏳ **AGUARDANDO APROVAÇÃO** antes de implementação  
**Fase**: 3 (próxima após infraestrutura)  
**Arquivo**: `frontend/src/dashboards/ExecutiveDashboard.tsx`

---

## 📊 Estrutura Visual (Baseada no Figma)

### Linha 1: KPI Cards (9 cards)
```
[Receita] [Meta] [% Meta] [Forecast] [Lucro] [Margem] [ROI] [ROAS] [CAC]
```

**Cards Detalhes**:
1. **Receita** - Valor + mudança (vs. mês anterior)
2. **Meta** - Valor fixo (sem mudança)
3. **% Meta** - Percentual + mudança (progresso)
4. **Forecast** - Receita prevista + mudança
5. **Lucro** - Valor + mudança (accent verde)
6. **Margem** - Percentual + mudança (accent verde)
7. **ROI** - Percentual + mudança (accent roxo)
8. **ROAS** - Valor + mudança (accent roxo)
9. **CAC** - Valor + mudança (accent ciano)

### Linha 2: KPI Cards (8 cards)
```
[Ticket Médio] [Consultas Hoje] [Consultas Amanhã] [Comparecimento] [No-show] [Leads] [Qualificados] [Vendas]
```

**Cards Detalhes**:
1. **Ticket Médio** - Valor + mudança
2. **Consultas Hoje** - Valor + sub "agendadas"
3. **Consultas Amanhã** - Valor + sub "agendadas"
4. **Comparecimento** - Percentual + mudança (accent verde)
5. **No-show** - Valor + mudança (accent vermelho)
6. **Leads** - Valor + mudança
7. **Qualificados** - Valor + mudança
8. **Vendas** - Valor + mudança (accent verde)

### Linha 3: Gráficos (2 seções)

#### Seção 1 (60% da largura): Gráfico de Linha
**"Receita vs. Meta vs. Forecast"**
- Período: Jan — Jun 2025 (dinâmico conforme filtro)
- Eixo X: Meses (Jan, Fev, Mar, Abr, Mai, Jun)
- Eixo Y: Valores em R$
- Linhas:
  - Receita (azul #6366f1, sólida)
  - Meta (verde #10b981, sólida)
  - Forecast (cinza #94a3b8, tracejada)
- Legenda no topo direito

#### Seção 2 (40% da largura): Funil
**"Funil Executivo"**
- Período: junho 2025
- 5-7 estágios (conforme dados)
- Estrutura:
  - Label do estágio
  - Barra horizontal com percentual
  - Valor absoluto
  - Percentual do total

### Linha 4: Gráficos Adicionais (quando aprovados)

⚠️ **A estrutura acima é mínima**. Possível expansão com:
- Receita por Origem (Pie Chart)
- Receita por Procedimento (Bar Chart)
- Ranking Profissionais (Table)
- Painel IA Executivo (AIInsight)
- Alertas (AlertCards)

**Esses elementos serão adicionados após aprovação da estrutura básica.**

---

## 🔌 Componentes a Utilizar

### Componentes Existentes
- ✅ **KPICard** - 17 unidades (9 + 8)
- ✅ **TopBar** - Título, breadcrumb, filtros, export
- ✅ **Sidebar** - Navegação
- ✅ **Layout** - Wrapper
- ✅ **Funnel** - Visualização do funil
- ⚠️ **LineChart** (Recharts) - Gráfico de receita

### Componentes Opcionais (Próximas fases)
- 🔄 **Pie/Bar Charts** - Para receita por origem/procedimento
- 🔄 **AnalyticalTable** - Para ranking profissionais
- 🔄 **AIInsight** - Painel de IA
- 🔄 **AlertCards** - Alertas contextuais

---

## 📡 Dados / APIs

### Mock Data (Desenvolvimento)
```typescript
// Utilizar:
kpiData {
  revenue, goal, goalPct, forecast, profit, margin,
  roi, roas, cac, avgTicket, appointmentsToday,
  appointmentsTomorrow, attendance, noShow, leads,
  qualified, sales
}

revenueVsGoal []  // Array com dados mensais
executiveFunnel [] // Array com estágios
```

### APIs Reais (Quando disponível)
```typescript
api.executive.getKPIs(period)    // GET all KPIs
api.executive.getRevenueChart()  // GET chart data
api.executive.getFunnel()        // GET funnel data
```

**Mapeamento**:
- period: filtro global (today, week, month, year)
- Dados filtrados em tempo real

---

## 🎨 Design System

### Cores Utilizadas
- Primária: #6366f1 (Receita, ROI, ROAS padrão)
- Verde: #10b981 (Lucro, Margem, Comparecimento, Vendas)
- Roxo: #8b5cf6 (ROI, ROAS alternativo)
- Ciano: #0ea5e9 (CAC)
- Vermelho: #ef4444 (No-show)
- Fundo: #f8fafc (light) ou #0f172a (dark)
- Borda: #e2e8f0 (light) ou #1e293b (dark)

### Tipografia
- Títulos de seção: 13px, semibold
- Labels: 11px, semibold, uppercase
- Valores KPI: 22px, bold
- Subtítulos: 11px, regular

### Espaçamento
- Gap entre cards: 12px
- Padding de seção: 24px
- Margin entre linhas: 24px
- Grid cols: 9, 8, 12 (responsivo)

---

## 🔄 Fluxo de Dados

```
User Filter (period, procedimento, etc)
    ↓
[FilterContext] atualiza filtro global
    ↓
ExecutiveDashboard.tsx detecta mudança
    ↓
useEffect([filters]) → api.executive.getKPIs()
    ↓
setState(kpiData)
    ↓
Re-render com dados atualizados
    ↓
Gráficos atualizam automaticamente
```

---

## 🚀 Tarefas de Implementação

- [ ] Criar arquivo `frontend/src/dashboards/ExecutiveDashboard.tsx`
- [ ] Importar componentes (KPICard, TopBar, Layout, Funnel, LineChart)
- [ ] Criar grid layout com Tailwind CSS
- [ ] Render 17 KPI Cards com dados de mock
- [ ] Render LineChart com recharts
- [ ] Render Funnel com dados
- [ ] Integrar useFilters() para dados dinâmicos
- [ ] Testar dark/light mode
- [ ] Testar responsividade (desktop, tablet, mobile)
- [ ] Criar documentação em `/docs/screens/executive-dashboard.md`
- [ ] Solicitar code review

---

## 📋 Checklist de Aprovação

Antes de começar, responda:

- [ ] **Estrutura visual aprovada?** (17 KPIs + 2 gráficos)
- [ ] **Componentes a utilizar aprovados?**
- [ ] **Design system cores aprovadas?**
- [ ] **APIs mockadas suficientes?**
- [ ] **Pronto para implementação sequencial?**

---

## ⚠️ Regra Crítica

**NÃO começar implementação sem aprovação desta estrutura.**

Alterações após "aprovado" causam retrabalho. Melhor aprovar completo aqui.

---

## 📝 Próximas Fases (Após Aprovação)

1. ✅ Estrutura aprovada
2. 🔄 Implementação (1-2 dias)
3. 🔄 Code review + ajustes
4. 🔄 Merged para main
5. ✅ Documentação criada
6. ➡️ **Fase 4: Marketing Dashboard**

---

**Status**: ⏳ Aguardando sua aprovação para prosseguir com implementação.

Dúvidas sobre a estrutura? Comente aqui antes de aprovar! 🚀
