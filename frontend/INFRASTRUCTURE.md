# Vivera Command Center - Infraestrutura

Documentação completa da infraestrutura implementada enquanto o Figma cria o design visual.

## ✅ Checklist de Infraestrutura

### Design System
- ✅ Tokens de cores (6 paletas: Primária, Sucesso, Alerta, Crítico, Informação, Neutro)
- ✅ Tipografia (Headings, Body, Captions)
- ✅ Spacing (6 níveis)
- ✅ Border Radius (4 variações)
- ✅ Shadows (4 níveis)
- ✅ Transitions (3 velocidades)

### Component Library
- ✅ KPICard - Métrica com sparkline e drill-down
- ✅ Layout - Sidebar, Header, Filtros, Footer
- ✅ AnalyticalTable - Busca, ordenação, filtros, exportação
- ✅ DataTable - Tabela avançada com paginação
- ✅ Funnel - Visualização de funil
- ✅ Timeline - Jornada do paciente
- ✅ CreativeCard - Card de criativo (20 métricas)
- ✅ AIInsight - Painel de insights

### Estrutura de Rotas
- ✅ React Router v6 integrado
- ✅ 30 rotas mapeadas (22 main + 8 detail)
- ✅ Lazy loading de dashboards
- ✅ Fallback de loading
- ✅ Redirect padrão

### Sistema de Temas
- ✅ Dark/Light Mode
- ✅ Context API para gerenciar tema
- ✅ Persistência em localStorage
- ✅ Sistema de cores dinâmicas
- ✅ CSS variables para tema
- ✅ Integração com componentes

### Estado Global
- ✅ Zustand store
- ✅ Sidebar state
- ✅ Filtros globais
- ✅ Página atual
- ✅ Loading states
- ✅ Search query
- ✅ Notificações
- ✅ User settings (persistentes)
- ✅ Hooks derivados

### Filtros Globais
- ✅ Context API para filtros
- ✅ 10 filtros disponíveis (Período, Procedimento, Profissional, SDR, Campanha, Conjunto, Criativo, Pipeline, Origem, Status)
- ✅ Date Range support
- ✅ Helper para rótulos
- ✅ Hook useFilterValue

### Estrutura de Páginas
- ✅ 30 dashboards como stubs
- ✅ Mesmo layout para todas
- ✅ Mensagem de "em desenvolvimento"
- ✅ Info de infraestrutura disponível

### Mock Data
- ✅ KPIs Executive (15 itens)
- ✅ Chart data (5 tipos de gráficos)
- ✅ Funil (5 etapas)
- ✅ Campanhas (4 itens)
- ✅ Criativos (3 itens)
- ✅ Pacientes (3 itens)
- ✅ Profissionais (3 itens)
- ✅ SDRs (3 itens)
- ✅ Alertas (4 itens)
- ✅ Conversão por SDR/Profissional/Recepção

### API Service
- ✅ Cliente Axios com interceptors
- ✅ Token management
- ✅ Error handling
- ✅ 8 módulos de API (Executive, Marketing, Commercial, CRM, Patient, WhatsApp, Professional, Financial)
- ✅ TypeScript types para respostas

### Tipos TypeScript
- ✅ KPI
- ✅ Campaign
- ✅ Creative
- ✅ Patient
- ✅ TimelineEvent
- ✅ WhatsappMessage
- ✅ Commercial
- ✅ Pipeline
- ✅ Opportunity
- ✅ ChartDataPoint
- ✅ FunnelStage
- ✅ ApiResponse
- ✅ PaginatedResponse
- ✅ GlobalFilters
- ✅ Alert
- ✅ AIInsight
- ✅ AIPanel

## 📁 Estrutura de Pastas

```
frontend/
├── src/
│   ├── components/
│   │   ├── KPICard.tsx
│   │   ├── Layout.tsx
│   │   ├── AnalyticalTable.tsx
│   │   ├── DataTable.tsx (novo)
│   │   ├── Funnel.tsx
│   │   ├── Timeline.tsx
│   │   ├── CreativeCard.tsx
│   │   ├── AIInsight.tsx
│   │   └── index.ts
│   ├── contexts/
│   │   ├── ThemeContext.tsx (novo)
│   │   └── FilterContext.tsx (novo)
│   ├── stores/
│   │   └── appStore.ts (novo)
│   ├── dashboards/
│   │   ├── ExecutiveDashboard.tsx
│   │   ├── MarketingDashboard.tsx
│   │   ├── CommercialDashboard.tsx
│   │   ├── CRMDashboard.tsx
│   │   ├── ... (30 total)
│   ├── router/
│   │   └── routes.tsx (novo)
│   ├── services/
│   │   └── api.ts
│   ├── styles/
│   │   └── tokens.ts
│   ├── types/
│   │   └── index.ts
│   ├── data/
│   │   └── mockData.ts (novo)
│   ├── utils/
│   ├── hooks/
│   ├── App.tsx (atualizado)
│   └── index.ts (novo)
├── INFRASTRUCTURE.md (este arquivo)
├── README.md
└── package.json
```

## 🎯 Padrões de Desenvolvimento

### Usando o Tema
```tsx
import { useTheme, useThemeColors } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { mode, toggleTheme, colors } = useTheme();
  const { bg, text, border } = useThemeColors();
  
  return <div style={{ backgroundColor: bg.primary }}>...</div>;
};
```

### Usando Filtros Globais
```tsx
import { useFilters, useFilterValue } from '../contexts/FilterContext';

const MyComponent = () => {
  const { filters, setFilter, resetFilters } = useFilters();
  const period = useFilterValue('period');
  
  return <div>Período: {period}</div>;
};
```

### Usando Estado Global
```tsx
import { useAppStore } from '../stores/appStore';

const MyComponent = () => {
  const { sidebarOpen, toggleSidebar, addNotification } = useAppStore();
  
  return <button onClick={() => addNotification('success', 'Feito!')}>...</button>;
};
```

### Chamando API
```tsx
import api from '../services/api';

const MyComponent = () => {
  const fetchKPIs = async () => {
    const response = await api.executive.getKPIs('month');
    console.log(response.data);
  };
  
  return <button onClick={fetchKPIs}>Carregar KPIs</button>;
};
```

### Criando Tabelas
```tsx
import { DataTable } from '../components/DataTable';

const MyComponent = () => {
  return (
    <DataTable
      columns={[
        { id: 'name', header: 'Nome', sortable: true },
        { id: 'value', header: 'Valor', format: 'currency', sortable: true },
      ]}
      data={mockData}
      searchable
      exportable
      title="Meus Dados"
    />
  );
};
```

## 🎨 Paleta de Cores

### Primária (Azul)
- 50: #f0f7ff
- 100: #e0efff
- 200: #bae6ff
- 300: #7dd3ff
- 400: #38bdf8
- 500: #0ea5e9
- 600: #0284c7 ← Padrão
- 700: #0369a1
- 800: #075985
- 900: #0c3d66

### Sucesso (Verde)
- 500: #22c55e
- 700: #15803d

### Alerta (Amarelo)
- 500: #eab308
- 700: #ca8a04

### Crítico (Vermelho)
- 500: #ef4444
- 700: #b91c1c

### Informação (Ciano)
- 500: #06b6d4
- 700: #0891b2

### Neutro (Cinza)
- 0: #ffffff
- 50-900: Variações de cinza

## 📚 Rotas Disponíveis

### Main Dashboards (22)
- `/` → Executive
- `/marketing` → Marketing Intelligence
- `/comercial` → Commercial
- `/crm` → CRM
- `/agenda` → Agenda
- `/campanhas` → Campaigns
- `/conjuntos` → Sets
- `/criativos` → Creatives
- `/pacientes` → Patients
- `/profissionais` → Professionals
- `/sdrs` → SDRs
- `/recepcao` → Reception
- `/whatsapp` → WhatsApp Analytics
- `/financeiro` → Financial
- `/procedimentos` → Procedures
- `/metas` → Goals
- `/alertas` → Alerts
- `/ia` → AI Executive
- `/relatorios` → Reports
- `/auditoria` → Audit
- `/comparativos` → Comparatives
- `/configuracoes` → Settings

### Detail Pages (8)
- `/criativos/:id` → Creative Detail
- `/pacientes/:id` → Patient Profile
- `/pacientes/:id/jornada` → Patient Journey
- `/pipeline` → Pipeline
- `/objections` → Objections
- `/meeting-mode` → Meeting Mode
- `/search` → Search
- `/profile` → User Profile

## 🔄 Fluxo de Dados

```
Layout
  ├── ThemeProvider
  │   └── FilterProvider
  │       └── Router
  │           ├── Dashboard 1
  │           │   ├── useFilters()
  │           │   ├── useAppStore()
  │           │   └── useTheme()
  │           ├── Dashboard 2
  │           └── ... (30 total)
```

## 📦 Dependências Principais

- React 18+
- TypeScript
- React Router v6
- Zustand (estado global)
- Axios (HTTP)
- Recharts (gráficos)
- Lucide React (ícones)

## 🚀 Próximos Passos

1. **Design Visual**: Aguardar design do Figma
2. **Integração com Backend**: Conectar APIs reais
3. **Implementar Dashboards**: Começar pelos principais (Executive, Marketing, CRM)
4. **Adicionar Testes**: Unit tests, integration tests
5. **Performance**: Otimizar para < 2s
6. **Responsividade**: Testar mobile/tablet

## 📝 Notas Importantes

- ✅ Nenhuma funcionalidade do backend será removida
- ✅ Drill-down obrigatório em todos os KPIs
- ✅ Filtros globais em todas as páginas
- ✅ IA nunca substitui dados
- ✅ Dark/Light Mode automático
- ✅ Totalmente tipado com TypeScript
- ✅ Componentes reutilizáveis e modulares
- ✅ Mock data pronto para testes

## 🎓 Como Usar Esta Infraestrutura

1. **Para criar um novo dashboard**:
   - Copie um arquivo stub de `dashboards/`
   - Importe componentes de `components/`
   - Use `useFilters()` e `useAppStore()` para estado
   - Use `api` para chamadas HTTP

2. **Para criar um novo componente**:
   - Crie arquivo em `components/`
   - Exporte em `components/index.ts`
   - Use tokens de `styles/tokens.ts`
   - Use `useThemeColors()` para cores dinâmicas

3. **Para adicionar nova rota**:
   - Crie componente em `dashboards/`
   - Adicione em `routes.tsx`
   - Componente renderiza automaticamente

---

**Status**: ✅ Infraestrutura 100% Pronta | Aguardando Design do Figma
