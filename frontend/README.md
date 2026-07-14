# Vivera Command Center - Frontend

Sistema operacional de inteligência empresarial para a clínica Vivera.

## 🎯 Status

**Fase 1: Design System + Componentes** ✅ COMPLETO

- ✅ Design System (tokens, cores, tipografia)
- ✅ 7 Componentes base (KPI Card, Layout, Tabela, Funil, Timeline, Criativo Card, AI Insight)
- ✅ Dashboard Executive (exemplo completo)
- ✅ Serviço de API

**Próximas Fases:**
- Fase 2: Dashboard Marketing
- Fase 3: Dashboard Comercial
- Fase 4: Dashboard CRM
- Fase 5: Dashboard WhatsApp
- Fase 6: Dashboards Complementares
- Fase 7: IA Executive
- Fase 8: QA + Validação

## 📦 Estrutura do Projeto

```
frontend/
├── src/
│   ├── components/           # Componentes reutilizáveis
│   │   ├── KPICard.tsx      # Card de KPI
│   │   ├── Layout.tsx       # Layout principal
│   │   ├── AnalyticalTable.tsx
│   │   ├── Funnel.tsx       # Funil de conversão
│   │   ├── Timeline.tsx     # Timeline do paciente
│   │   ├── CreativeCard.tsx # Card de criativo
│   │   ├── AIInsight.tsx    # Painel IA
│   │   └── index.ts         # Exportações
│   ├── dashboards/          # Dashboards/telas
│   │   └── ExecutiveDashboard.tsx
│   ├── services/            # Serviços de API
│   │   └── api.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── styles/              # Design tokens
│   │   └── tokens.ts
│   ├── utils/               # Utilitários
│   ├── hooks/               # Custom hooks
│   ├── App.tsx              # App principal
│   └── index.tsx            # Entry point
├── public/
├── package.json
└── README.md
```

## 🎨 Design System

### Cores
- **Primária**: Azul profundo (0284c7)
- **Sucesso**: Verde (22c55e)
- **Alerta**: Amarelo (eab308)
- **Crítico**: Vermelho (ef4444)
- **Informação**: Ciano (06b6d4)
- **Neutro**: Cinza (múltiplas tonalidades)

### Componentes Base
1. **KPI Card** - Métrica com comparação, tendência e drill-down
2. **Tabela Analítica** - Busca, ordenação, filtros, exportação CSV/XLSX
3. **Funil** - Visualização de conversão com múltiplas etapas
4. **Timeline** - Jornada do paciente com eventos
5. **Criativo Card** - Card grande com 20 métricas de criativo
6. **AI Insight** - Painel de insights de IA
7. **Layout** - Estrutura com sidebar, header, filtros globais

## 🚀 Como Começar

### Instalação

```bash
cd frontend
npm install
```

### Desenvolvimento

```bash
npm start
```

Abre em http://localhost:3000

### Build

```bash
npm run build
```

## 📊 Dashboards Implementados

### ✅ Executive Dashboard (Fase 1)
- 8 KPI Cards (Receita, Meta, %, Previsão IA, Lucro, ROAS, CAC, Ticket)
- Gráfico: Receita x Meta x Previsão (linha)
- Funil Executivo (5 etapas)
- Receita por Origem (pie chart)
- Receita por Procedimento (pie chart)
- Agenda + Alertas
- Painel IA Executivo (4 cards)
- Painel "O que exige atenção" (AI Insight Panel)

### ⏳ Marketing (Fase 2)
- 17 KPIs
- 3 Gráficos
- Ranking Campanhas/Conjuntos
- Galeria Criativos
- Tela de Criativo (Detalhe)

### ⏳ Comercial (Fase 3)
- Conversão por SDR/Profissional/Recepção
- Motivos de perda
- Tempo até venda

### ⏳ CRM (Fase 4)
- Pipeline Kanban
- Timeline
- Jornada
- Gargalos

### ⏳ WhatsApp (Fase 5)
- Mensagens/Ligações
- Tempo de resposta
- Heatmaps

### ⏳ Complementares (Fase 6)
- Profissionais
- Financeiro
- Agenda

## 🔌 API Integration

Todos os componentes estão integrados com a API backend via `services/api.ts`. As chamadas são organizadas por módulo:

- `executiveAPI` - Dashboard Executive
- `marketingAPI` - Marketing
- `commercialAPI` - Comercial
- `crmAPI` - CRM
- `patientAPI` - Pacientes
- `whatsappAPI` - WhatsApp
- `professionalAPI` - Profissionais
- `financialAPI` - Financeiro

## 🎯 Próximos Passos

1. **Fase 2**: Implementar Dashboard Marketing
2. **Fase 3**: Implementar Dashboard Comercial
3. **Conectar com Backend**: Integrar APIs reais
4. **Performance**: Otimizar para < 2s
5. **Testes**: Adicionar testes unitários
6. **Responsividade**: Testar em mobile/tablet

## 📝 Regras Absolutas

✅ **Nenhuma funcionalidade será removida**
- Todos os endpoints do sistema atual serão preservados
- Todos os KPIs, tabelas e gráficos permanecerão disponíveis

✅ **Drill-down obrigatório**
- Todo KPI é clicável
- Todos os gráficos permitem exploração em detalhe

✅ **Filtros globais**
- Todos os filtros afetam todas as páginas
- 10 filtros disponíveis: Período, Procedimento, Profissional, SDR, Campanha, Conjunto, Criativo, Pipeline, Origem, Status

✅ **IA nunca substitui**
- IA apenas explica os dados
- Nunca remove visualizações existentes

## 🛠️ Tecnologias

- React 18+
- TypeScript
- Tailwind CSS
- Recharts (Gráficos)
- Axios (HTTP)
- Zustand (State Management - opcional)
- Lucide React (Icons)

## 📄 Licença

MIT
