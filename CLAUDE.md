# Vivera Command Center

> Sistema operacional de inteligência empresarial para a clínica Vivera

## 🎯 Objetivo

Transformar o dashboard atual em um sistema completo de BI mantendo 100% das funcionalidades existentes, reorganizando UX e adicionando inteligência com IA.

## 📋 Regras Absolutas

1. **Nenhuma funcionalidade será removida** - Todos os endpoints, cálculos, métricas, cards, tabelas e indicadores do sistema atual serão preservados
2. **Tudo reorganizado e enriquecido** - Novo layout, drill-down, comparativos, gráficos estilo Looker Studio
3. **Drill-down obrigatório** - Todo número é clicável e permite exploração em detalhe
4. **Filtros globais** - Todos os filtros afetam todas as páginas
5. **IA nunca substitui** - IA apenas explica os dados, nunca remove visualizações

## 🏗️ Arquitetura

### Frontend
- React 18+ TypeScript
- TailwindCSS + shadcn/ui para componentes
- Recharts para gráficos
- React Router v6 para navegação
- Zustand para state management

### Backend
- Node.js/Express (existente)
- Endpoints preservados 100%
- API Mapping documentada
- Cache e otimizações

### Estrutura de Pastas
```
frontend/
├── src/
│   ├── components/           # Componentes reutilizáveis (KPI Card, Tabela, etc)
│   ├── dashboards/          # 30 dashboards/telas
│   ├── hooks/               # Custom hooks
│   ├── services/            # API calls
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities
│   ├── styles/              # Design tokens
│   └── App.tsx
backend/
├── server.js
├── routes/                  # Endpoints preservados
└── middleware/
```

## 📐 Roadmap (8 Fases)

### Fase 1: Design System + Componentes (ATUAL)
- [ ] Criar estrutura React/TypeScript
- [ ] Design System (tokens, cores, tipografia)
- [ ] 10 Componentes base (KPI Card, Tabela, Funil, Timeline, etc)
- [ ] Layout principal (Sidebar, Header, Filtros globais)

### Fase 2: Dashboard Executive
- [ ] Implementar 8 KPI Cards
- [ ] Gráfico Receita x Meta x Previsão
- [ ] Funil Executivo
- [ ] Receita por Origem e Procedimento
- [ ] Painel IA Executivo

### Fase 3: Dashboard Marketing
- [ ] 17 KPIs
- [ ] 3 Gráficos (Receita x Investimento, ROAS Diário, Leads x Compras)
- [ ] Ranking Campanhas/Conjuntos
- [ ] Galeria Criativos
- [ ] Tela de Criativo (Detalhe)

### Fase 4: Dashboard Comercial
- [ ] KPIs Comerciais
- [ ] Conversão por SDR/Profissional/Recepção
- [ ] Motivos de perda
- [ ] Tempo até venda

### Fase 5: Dashboard CRM
- [ ] Pipeline Kanban
- [ ] Timeline
- [ ] Jornada
- [ ] Gargalos
- [ ] Recuperação de oportunidades

### Fase 6: Dashboards Complementares
- [ ] WhatsApp Analytics
- [ ] Profissionais
- [ ] Financeiro
- [ ] Agenda

### Fase 7: IA Executive
- [ ] Painel IA contextual
- [ ] Análises automáticas
- [ ] Alertas inteligentes

### Fase 8: QA + Validação
- [ ] Testar todas as telas
- [ ] Verificar drill-down completo
- [ ] Performance < 2s
- [ ] Responsivo Desktop/Tablet/Mobile

## 🎨 Design System

### Cores
- Primária: Azul profundo
- Sucesso: Verde
- Alerta: Amarelo
- Crítico: Vermelho
- Informação: Ciano
- Neutro: Cinza

### Componentes
1. **KPI Card** - Valor, comparação, tendência, drill-down
2. **Tabela Analítica** - Busca, ordenação, filtros, exportação
3. **Card Criativo** - 20 métricas
4. **Funil** - 7 elementos por etapa
5. **Timeline** - 7 etapas do paciente
6. **Insight IA** - 5 elementos
7. **Alert Card** - 4 tipos
8. **Drawer Lateral** - 6 seções
9. **Filtros Globais** - 10 filtros
10. **Gráficos** - Linha, Barras, Rosca, Heatmap

## 📊 KPIs Preservados

### Executive Dashboard (28 KPIs)
Receita (dia/semana/mês), Meta, % Meta, Receita Prevista IA, Lucro, Margem, CAC, ROI, ROAS, Ticket, Leads, Qualificados, Agendados, Comparecidos, Compraram, Agenda Hoje, Agenda Amanhã, No-show, Reagendamentos

### Marketing (21 KPIs)
Investimento, Receita, ROAS, ROI, CAC, CPL, CTR, CPC, CPM, Impressões, Cliques, Leads, Mensagens, Compras, Ticket, Receita por Lead, Receita por Agendamento, Tendência

### Comercial (13 KPIs)
Leads, Qualificados, Agendados, Compareceram, Compraram, Conversão, Ticket, Receita, Tempo até primeiro contato, Tempo até venda, Conversão por profissional/SDR/recepção

### CRM (15 KPIs)
Pipeline, Timeline, Histórico, Procedimentos, Campanha, Conjunto, Criativo, Origem, WhatsApp, Receita, Gargalos, Tempo por etapa, Recuperação

### WhatsApp (9 KPIs)
Mensagens enviadas/recebidas, Ligações, Perdidas, Tempo primeira resposta, Tempo médio, Conversão, Ranking, Heatmaps

## 🔗 Drill-down Principal

```
Receita
  → Origem
    → Campanha
      → Conjunto
        → Criativo
          → Paciente
            → Perfil do Paciente
```

## 🚀 Como Começar

1. Instalar dependências: `npm install`
2. Criar estrutura React: `npx create-react-app frontend`
3. Implementar Design System
4. Começar com componentes base
5. Construir Dashboard Executive

## ✅ Checklist QA Final

- [ ] Nenhum KPI removido
- [ ] Nenhuma tabela removida
- [ ] Nenhum endpoint perdido
- [ ] Todos KPIs clicáveis
- [ ] Drill-down completo
- [ ] Responsivo Desktop/Tablet/Mobile
- [ ] Dark/Light Mode
- [ ] Exportação CSV/XLSX
- [ ] Performance < 2s
- [ ] IA contextual em todas as telas

## 📚 Documentação

- Parte 1: Product Requirements
- Parte 2: Backend Mapping
- Parte 3: Design System
- Parte 4: Information Architecture
- Parte 5: Dashboard Executive
- Parte 6: Dashboard Marketing
- Parte 7: Component Library
- Parte 8: UX Flows
- Parte 9+: Wireframes, Dashboards, IA, API Mapping, QA Checklist, Roadmap
