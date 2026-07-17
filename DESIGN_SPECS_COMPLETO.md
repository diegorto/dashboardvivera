# 📊 ESPECIFICAÇÕES COMPLETAS - INSIGHTS VIVERA DASHBOARD
## Documentação Detalhada para Reprodução em Figma

---

## 📋 ÍNDICE

1. [Visão Geral do Projeto](#visão-geral)
2. [Estrutura de Pastas & Arquitetura](#estrutura)
3. [Design System & Cores](#design-system)
4. [Tipografia](#tipografia)
5. [Componentes Reutilizáveis](#componentes)
6. [Integração de Dados](#integração)
7. [Endpoints da API](#endpoints)
8. [Estrutura de Dados JSON](#dados-json)
9. [Cada Página Detalhada](#páginas)
10. [Fluxo de Dados](#fluxo)
11. [Responsividade](#responsividade)

---

## 🎯 VISÃO GERAL DO PROJETO {#visão-geral}

**Nome**: Insights Vivera  
**Tipo**: Dashboard de análise de Marketing & Vendas  
**Tecnologia**: React 19 + TypeScript + Vite + Tailwind CSS  
**Backend**: Vercel Serverless Functions (Node.js)  
**Deployment**: Vercel  
**URL**: https://dashboardvivera.vercel.app  

### Objetivo
Dashboard executivo para visualizar em tempo real:
- KPIs de Marketing (ROAS, CAC, CPC, CTR)
- Funil de conversão (Leads → Vendas)
- Pipeline de deals agrupado por timing
- Desempenho de criativos (anúncios)
- Gestão de leads parados/em risco
- Auditoria de dados de leads

---

## 📂 ESTRUTURA DE PASTAS & ARQUITETURA {#estrutura}

```
insights-vivera/
├── api/                          # Serverless Functions (Vercel)
│   ├── dashboard.js             # GET /api/dashboard - Dados principais
│   ├── funil-real.js            # GET /api/funil-real - Dados do funil
│   ├── health.js                # GET /api/health - Health check
│   ├── test.js                  # GET /api/test - Endpoint de teste
│   ├── ad-preview/[adId].js     # GET /api/ad-preview/:adId - Preview de anúncio
│   └── tintim-audit/
│       ├── index.js             # GET /api/tintim-audit - Auditoria de leads
│       └── apply.js             # POST /api/tintim-audit/apply - Aplicar sugestões
│
├── web/                          # React Frontend App
│   ├── src/
│   │   ├── pages/               # 12 páginas do dashboard
│   │   │   ├── HomePage.tsx              # / - Dashboard principal
│   │   │   ├── CampanhasPage.tsx        # /campanhas - Campanhas (placeholder)
│   │   │   ├── FunilPage.tsx            # /funil - Funil completo
│   │   │   ├── PipelinePage.tsx         # /pipeline - Pipeline por tempo
│   │   │   ├── LeadsParadosPage.tsx     # /pipeline/parados - Leads > 30 dias
│   │   │   ├── PacientesPage.tsx        # /pacientes - Todos os clientes
│   │   │   ├── RecepcaoPage.tsx         # /recepcao - KPIs de recepção
│   │   │   ├── InsightsPage.tsx         # /insights - Alertas automáticos
│   │   │   ├── SemOrigemPage.tsx        # /sem-origem - Leads órfãos
│   │   │   ├── OutrasFontesPage.tsx     # /outras-fontes - Canais secundários
│   │   │   ├── TintimAuditoriaPage.tsx  # /auditoria-tintim - Verificação de dados
│   │   │   └── ReuniaoPage.tsx          # /reuniao - Dashboard tela cheia (TV)
│   │   │
│   │   ├── components/          # Componentes reutilizáveis
│   │   │   ├── Layout.tsx               # Wrapper: Sidebar + Header + Main
│   │   │   ├── Sidebar.tsx              # Menu lateral com navegação
│   │   │   ├── MobileNav.tsx            # Menu responsivo (mobile)
│   │   │   ├── FilterBar.tsx            # Seletor de datas + filtros
│   │   │   ├── KpiCard.tsx              # Card com valor + variação %
│   │   │   ├── CreativesTable.tsx       # Tabela de criativos com ranking
│   │   │   ├── LostCreativesTable.tsx   # Tabela de criativos perdidos
│   │   │   ├── MiniFunnel.tsx           # Visualização mini funil
│   │   │   ├── Sparkline.tsx            # Gráfico de trend (linha)
│   │   │   ├── SalesGroup.tsx           # Grupo de vendas em card
│   │   │   ├── StuckDealsGroup.tsx      # Grupo de deals travados
│   │   │   ├── DeltaIndicator.tsx       # Indicador de variação (seta)
│   │   │   ├── StatusPill.tsx           # Badge com status
│   │   │   ├── SortHeader.tsx           # Header de tabela com sort
│   │   │   ├── AdPreviewModal.tsx       # Modal com preview de anúncio
│   │   │   └── ui/                      # Componentes base (shadcn/ui)
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── table.tsx
│   │   │       ├── tabs.tsx
│   │   │       └── badge.tsx
│   │   │
│   │   ├── lib/                 # Utilitários e contexto
│   │   │   ├── FilterContext.tsx        # Contexto de filtros + carregamento de dados
│   │   │   ├── dateRanges.ts           # Presets de datas (hoje, semana, mês, etc)
│   │   │   ├── useSort.ts              # Hook para ordenação de tabelas
│   │   │   ├── useTheme.ts             # Hook para dark/light mode
│   │   │   ├── useDecisions.ts         # Lógica de filtros secundários
│   │   │   ├── exportXlsx.ts           # Exportar dados para Excel
│   │   │   ├── utils.ts                # Funções utilitárias (format, parse, etc)
│   │   │   └── nav.ts                  # Definição das rotas e menu
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts               # Função para chamar /api/dashboard
│   │   │   └── types.ts                # Interfaces TypeScript de tipos
│   │   │
│   │   ├── App.tsx              # Roteador principal (React Router)
│   │   ├── main.tsx             # Entry point com ErrorBoundary
│   │   ├── ErrorBoundary.tsx    # Captura de erros React
│   │   └── index.css            # Estilos globais + Tailwind
│   │
│   ├── public/                  # Arquivos estáticos
│   ├── index.html              # Template HTML
│   ├── vite.config.ts          # Configuração do Vite
│   ├── tailwind.config.js       # Tema Tailwind
│   ├── postcss.config.js        # PostCSS para Tailwind
│   ├── tsconfig.json           # TypeScript config
│   └── package.json            # Dependências do frontend
│
├── vercel.json                  # Configuração de deployment
├── package.json                 # Root package.json
├── .env.example                 # Variáveis de ambiente
└── .gitignore                   # Arquivos ignorados no git
```

---

## 🎨 DESIGN SYSTEM & CORES {#design-system}

### Paleta de Cores

**Modo Claro (Light Mode)**
```
Fundo principal:           #ffffff (White)
Fundo secundário:          #f8fafc (Slate 50)
Fundo terciário:           #f1f5f9 (Slate 100)
Texto primário:            #0f172a (Slate 900)
Texto secundário:          #64748b (Slate 500)
Texto terciário:           #94a3b8 (Slate 400)
Borda:                     #e2e8f0 (Slate 200)
Borda forte:               #cbd5e1 (Slate 300)

Verde (Positivo):          #10b981 (Emerald 500)
Verde claro:               #d1fae5 (Emerald 100)
Vermelho (Negativo):       #ef4444 (Red 500)
Vermelho claro:            #fee2e2 (Red 100)
Amarelo (Aviso):           #f59e0b (Amber 500)
Amarelo claro:             #fef3c7 (Amber 100)
Azul (Info):               #3b82f6 (Blue 500)
Azul claro:                #dbeafe (Blue 100)

Violeta (Accent):          #8b5cf6 (Violet 500)
Violeta claro:             #ede9fe (Violet 100)
```

**Modo Escuro (Dark Mode)**
```
Fundo principal:           #0f172a (Slate 900)
Fundo secundário:          #1e293b (Slate 800)
Fundo terciário:           #334155 (Slate 700)
Texto primário:            #f1f5f9 (Slate 100)
Texto secundário:          #cbd5e1 (Slate 300)
Texto terciário:           #94a3b8 (Slate 400)
Borda:                     #475569 (Slate 600)
Borda forte:               #64748b (Slate 500)

Verde (Positivo):          #10b981 (Emerald 500) - mantém
Verde claro:               #064e3b (Emerald 900)
Vermelho (Negativo):       #f87171 (Red 400)
Vermelho claro:            #7f1d1d (Red 900)
Amarelo (Aviso):           #fbbf24 (Amber 400)
Amarelo claro:             #78350f (Amber 900)
Azul (Info):               #60a5fa (Blue 400)
Azul claro:                #1e3a8a (Blue 900)
```

### Tokens de Design

```
Espaçamento:
- 4px   (xs)
- 8px   (sm)
- 12px  (md)
- 16px  (lg)
- 20px  (xl)
- 24px  (2xl)
- 32px  (3xl)

Border Radius:
- 0px      (none)
- 4px      (sm)
- 6px      (md)
- 8px      (lg)
- 12px     (xl)

Shadows:
- sm:  0 1px 2px rgba(0,0,0,0.05)
- md:  0 4px 6px rgba(0,0,0,0.07)
- lg:  0 10px 15px rgba(0,0,0,0.1)
- xl:  0 20px 25px rgba(0,0,0,0.15)

Breakpoints (Tailwind):
- sm:  640px
- md:  768px
- lg:  1024px
- xl:  1280px
- 2xl: 1536px
```

---

## 🔤 TIPOGRAFIA {#tipografia}

### Fonte Principal
**Font Family**: Inter (sem serifa, clean, moderna)

### Hierarquia de Texto

```
Títulos de Página (H1)
- Font Size: 28-32px
- Font Weight: 700 (Bold)
- Line Height: 1.2
- Letter Spacing: -0.5px
- Color: Slate 900 (light) / Slate 100 (dark)

Subtítulos (H2)
- Font Size: 20-24px
- Font Weight: 600 (Semibold)
- Line Height: 1.3
- Color: Slate 800 (light) / Slate 200 (dark)

Títulos de Seção (H3)
- Font Size: 16-18px
- Font Weight: 600 (Semibold)
- Line Height: 1.4
- Color: Slate 700 (light) / Slate 300 (dark)

Texto Padrão (Body)
- Font Size: 14px
- Font Weight: 400 (Regular)
- Line Height: 1.5
- Color: Slate 600 (light) / Slate 400 (dark)

Texto Pequeno (Small)
- Font Size: 12px
- Font Weight: 400 (Regular)
- Line Height: 1.4
- Color: Slate 500 (light) / Slate 500 (dark)

Label/Tag
- Font Size: 11px
- Font Weight: 600 (Semibold)
- Line Height: 1.3
- Text Transform: Uppercase
- Letter Spacing: 0.5px
- Color: Slate 600 (light) / Slate 400 (dark)
```

---

## 🧩 COMPONENTES REUTILIZÁVEIS {#componentes}

### 1. KPI Card
**Uso**: Mostrar valores principais com variação  
**Props**:
- `title`: string - "Faturamento"
- `value`: number - 45000
- `unit`: string - "R$"
- `deltaPct`: number - 12.5 (positivo/negativo)
- `icon`: ReactNode - Ícone do lucide-react
- `trend`: 'up' | 'down' | 'neutral'

**Visual**:
```
┌─────────────────────────────────┐
│ 💰 Faturamento        ↑ 12.5%   │
│                                  │
│ R$ 45.000                        │
│                                  │
│ vs período anterior: ↑ R$ 5.100 │
└─────────────────────────────────┘
```

### 2. CreativesTable
**Uso**: Listar criativos com ranking  
**Colunas**:
- Campanha
- Conjunto
- Anúncio
- Investimento (R$)
- Leads
- Taxa de Conversão (%)
- ROAS
- Status (escalar/manter/pausar)

**Recursos**:
- Ordenação por coluna
- Filtros por campanha/conjunto
- Export para Excel
- Cores por status
- Ícones de tendência

### 3. MiniFunnel
**Uso**: Visualizar conversão em formato funil  
**Formato**:
```
┌──────────────────┐
│ Leads            │ 726 (100%)
├──────────────┐
│ Qualificados │ 380 (52%)
├─────────┐
│ Agendados │ 190 (26%)
├──────┐
│ Compareceu │ 150 (21%)
├─────┐
│ Vendidos │ 120 (17%)
└─────┘
```

### 4. Sparkline
**Uso**: Mostrar trend de uma métrica ao longo do tempo  
**Props**:
- `data`: number[] - Array com valores últimos 7/30 dias
- `color`: 'green' | 'red' | 'blue'
- `height`: number - Altura do gráfico

### 5. FilterBar
**Uso**: Seletor de datas e filtros  
**Componentes**:
- Date Range Picker (desde/até)
- Presets: Hoje, Semana, Mês, Semestre, Customizado
- Filtros secundários: Campanha, Conjunto, Criativo, Closer, SDR
- Botão de Limpar Filtros
- Botão de Recarregar

### 6. DeltaIndicator
**Uso**: Mostrar seta de variação com cor  
**Visual**:
```
↑ 12.5%  (verde se positivo)
↓ -5%    (vermelho se negativo)
→ 0%     (neutro se 0)
```

### 7. StatusPill
**Uso**: Badge com status  
**Estilos**:
- `success`: Verde com ícone ✓
- `error`: Vermelho com ícone ✗
- `warning`: Amarelo com ícone ⚠
- `info`: Azul com ícone ℹ
- `default`: Cinza neutro

### 8. SortHeader (Tabela)
**Uso**: Header de coluna com sort  
**Visual**:
```
Coluna Nome     ↕  (click para ordenar)
```

---

## 🔌 INTEGRAÇÃO DE DADOS {#integração}

### Fluxo de Carregamento

```
[App monta]
    ↓
[FilterContext inicia com data de hoje]
    ↓
[fetchDashboard(since, until) chamado]
    ↓
[GET /api/dashboard?since=...&until=...]
    ↓
[Backend retorna DashboardResponse JSON]
    ↓
[Filtros secundários aplicados localmente]
    ↓
[Componentes renderizam dados]
```

### Cliente API (web/src/api/client.ts)

```typescript
export async function fetchDashboard(since: string, until: string): Promise<DashboardResponse> {
  const params = new URLSearchParams({ since, until });
  const res = await fetch(`/api/dashboard?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

### Contexto de Filtros (FilterContext)

**Estados gerenciados**:
- `since` / `until`: Datas do período
- `filters`: Filtros secundários (campanha, conjunto, criativo, etc)
- `data`: Resposta JSON da API
- `loading`: Boolean indicando carregamento
- `error`: String com erro (se houver)

**Métodos expostos**:
- `setRange(since, until)`: Altera período
- `applyPreset(key)`: Aplica preset de data (mesAtual, ultimosMeses30, etc)
- `setFilter(key, value)`: Aplica filtro secundário
- `clearFilters()`: Limpa todos os filtros
- `reload()`: Força recarregamento dos dados

---

## 🔗 ENDPOINTS DA API {#endpoints}

### GET /api/dashboard

**Query Params**:
```
since: string (YYYY-MM-DD) - Data inicial do período
until: string (YYYY-MM-DD) - Data final do período
```

**Response** (200 OK):
```json
{
  "success": true,
  "range": {
    "since": "2026-06-14",
    "until": "2026-07-14"
  },
  "previousRange": {
    "since": "2026-05-14",
    "until": "2026-06-14"
  },
  "kpis": { /* vide seção KPIs abaixo */ },
  "creatives": [ /* vide seção Criativos abaixo */ ],
  "funnel": { /* vide seção Funil abaixo */ },
  "pipeline": { /* vide seção Pipeline abaixo */ },
  "patients": [ /* vide seção Pacientes abaixo */ ],
  "revenueAtRisk": { /* vide seção Receita em Risco */ },
  "leadSources": { /* vide seção Origem de Leads */ },
  "insights": [ /* vide seção Insights */ ],
  "recepcao": { /* vide seção Recepção */ },
  "faturamentoTotal": { /* vide seção Faturamento Total */ }
}
```

### GET /api/funil-real

**Response** (200 OK):
```json
{
  "success": true,
  "stages": [
    {
      "key": "leads",
      "label": "Leads",
      "count": 726,
      "pctFromStart": 100,
      "pctLossFromPrev": null,
      "perdidos": 50
    },
    // ... mais etapas
  ]
}
```

### GET /api/health

**Response** (200 OK):
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-07-14T10:30:45.123Z"
}
```

### GET /api/ad-preview/[adId]

**Params**:
- `adId`: string - ID do anúncio (ex: "ad_123")

**Response** (200 OK):
```json
{
  "success": true,
  "adId": "ad_123",
  "thumbnailUrl": "https://...",
  "adUrl": "https://...",
  "adStatus": "active",
  "title": "BOTOX - Preço Imperdível",
  "description": "Descubra os benefícios...",
  "ctr": 2.1,
  "cpc": 26.3,
  "impressoes": 850
}
```

### GET /api/tintim-audit

**Query Params**:
```
status?: string - "crítico" | "aviso" | "ok"
limit?: number - Quantidade de resultados (default: 50)
```

**Response** (200 OK):
```json
{
  "success": true,
  "total": 15,
  "problemas": [
    {
      "dealId": 1,
      "nome": "Deal XYZ",
      "status": "crítico",
      "camposFaltando": ["campanha", "conjunto"],
      "sugestoes": [
        {
          "campo": "campanha",
          "valorSugerido": "PAT | [HOF]",
          "confianca": 0.95
        }
      ]
    }
  ]
}
```

### POST /api/tintim-audit/apply

**Body**:
```json
{
  "dealId": 1,
  "sugestoes": [
    {
      "campo": "campanha",
      "novoValor": "PAT | [HOF]"
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "dealId": 1,
  "applied": 1,
  "failed": 0
}
```

---

## 📦 ESTRUTURA DE DADOS JSON {#dados-json}

### KPIs

```typescript
interface KPI {
  current: number;      // Valor atual no período
  deltaPct: number;     // Variação em % vs período anterior
}

// Exemplo:
"kpis": {
  "receita": { current: 45000, deltaPct: 12.5 },
  "compras": { current: 150, deltaPct: -5 },
  "ticketMedio": { current: 300, deltaPct: 0 },
  "investimento": { current: 8000, deltaPct: 10 },
  "roas": { current: 5.6, deltaPct: 15 },
  "cac": { current: 53, deltaPct: -8 },
  "tempoMedioFechamento": { current: 5, deltaPct: 2 },
  "taxa_fechamento": { current: 0.165, deltaPct: 0.02 }
}
```

### Creative (Anúncio/Criativo)

```typescript
interface Creative {
  campanha: string;              // "PAT | [HOF][MELHORES CRIATIVOS]"
  conjunto: string;              // "[QUENTE][MELHORES CRIATIVOS][IG]"
  anuncio: string;               // "02 [VD] - BOTOX"
  
  // Performance
  investimento: number;          // Em R$
  leads: number;
  qualificados: number;
  agendados: number;
  compareceram: number;
  compras: number;
  perdidos: number;
  receita: number;               // Em R$
  
  // Métricas de Ads
  impressoes: number;
  cliques: number;
  ctr: number;                   // Click-through rate (%)
  cpc: number;                   // Custo por clique (R$)
  roas: number;                  // Return on ad spend (múltiplo)
  
  // Análise
  objecoes: Array<{
    tag: string;                 // "preço alto", "não confio", etc
    count: number;
  }>;
  
  // Trend
  trend: number[];               // Últimos 7/30 dias
  trendDirection: 'up' | 'down';
  
  // Status
  status: 'escalar' | 'manter' | 'pausar' | 'testar';
  
  // Imagem & Links
  thumbnailUrl: string | null;
  adUrl: string | null;
  adStatus: string | null;       // "active", "paused", "disapproved"
  adId: string | null;
}
```

### Funnel (Funil)

```typescript
interface FunnelStage {
  key: string;                  // "leads", "qualificados", etc
  label: string;                // "Leads", "Qualificados", etc
  count: number;                // Quantidade nesta etapa
  pctFromStart: number;         // % do total (base 100)
  pctLossFromPrev: number | null; // % perdidos vs etapa anterior
  perdidos: number;             // Quantity that were lost
  objecoes: Array<{
    tag: string;
    count: number;
  }>;
}

interface Funnel {
  stages: FunnelStage[];
  topCreativesByStage: Record<string, Creative[]>;  // Top 3 por etapa
  insights: string[];           // Alertas gerados
}
```

### Pipeline (Deals)

```typescript
interface PipelineBucket {
  label: string;                // "Até 7 dias", "8-15 dias", etc
  count: number;                // Quantidade de deals
  potentialValue: number;       // Valor potencial em R$
  deals: Array<{
    id: number;
    nome: string;
    valor: number;
    diasAteFechamento: number;
    proximaAcao: string;
    closer: string;
  }>;
}

interface Pipeline {
  buckets: PipelineBucket[];
  etapas: any[];
  stuckCreatives: Creative[];   // Criativos com deals travados
  slowestCampaigns: string[];   // Campanhas com ciclo longo
}
```

### Patient (Paciente/Cliente)

```typescript
interface Patient {
  id: number;
  nome: string;
  telefone: string;
  
  origem: {
    criativo: string;
    campanha: string;
    conjunto: string;
  };
  
  responsaveis: {
    closer: string | null;      // Vendedor
    sdr: string | null;         // Qualificador
  };
  
  funil: {
    status: 'open' | 'closed' | 'lost';
    procedimento: string;       // Tipo de procedimento
    dataLead: string;           // YYYY-MM-DD
    dataVenda: string | null;   // YYYY-MM-DD ou null
    tempoAteFechar: number | null; // Em dias
  };
  
  financeiro: {
    valor: number;              // Em R$
    formaPagamento: string;     // "à vista", "parcelado", etc
  };
  
  relacionamento: {
    pipedriveUrl: string;
    ultimaAtualizacao: string;
  };
}
```

### Revenue at Risk (Receita em Risco)

```typescript
interface RevenueAtRisk {
  qualificadosSemAgendamento: {
    count: number;
    semOrcamento: number;
    value: number;              // Em R$
    deals: Patient[];
  };
  agendadosFaltaram: {
    count: number;
    semOrcamento: number;
    value: number;
    deals: Patient[];
  };
  propostasSemFechamento: {
    count: number;
    semOrcamento: number;
    value: number;
    deals: Patient[];
  };
  total: number;                // Soma de todos os valores em risco
}
```

### Lead Source (Origem de Leads)

```typescript
interface LeadSource {
  google?: {
    leads: number;
    cpl: number;                // Custo por lead
    roas: number;
    receita: number;
  };
  meta?: {
    leads: number;
    cpl: number;
    roas: number;
    receita: number;
  };
  indicacao?: {
    leads: number;
    receita: number;
  };
  outros?: {
    leads: number;
    receita: number;
  };
}
```

### Insight (Alerta Automático)

```typescript
interface Insight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  text: string;                 // Descrição do alerta
  recommendation?: string;      // Ação sugerida
  relatedMetric?: string;       // KPI relacionado
  targetValue?: number;         // Valor alvo
  currentValue?: number;        // Valor atual
}
```

### Recepcao (KPIs da Recepção)

```typescript
interface Recepcao {
  kpis: {
    receita: KPI;
    compras: KPI;
    ticketMedio: KPI;
  };
  fechamentos: Array<{
    id: number;
    nome: string;
    telefone: string;
    valor: number;              // Em R$
    procedimento: string;
    data: string;               // YYYY-MM-DD
    pipedriveUrl: string;
  }>;
}
```

---

## 📄 CADA PÁGINA DETALHADA {#páginas}

### 🏠 HOME PAGE (/)

**Objetivo**: Dashboard executivo com visão geral completa

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo | Dark/Light Toggle | User Menu              │
├─────────────────────────────────────────────────────────────┤
│ SIDEBAR                    │  MAIN CONTENT                   │
│                             │                                 │
│ • Home                      │  ┌─────────────────────────┐   │
│ • Campanhas                 │  │ FILTRO: Data Range      │   │
│ • Funil                     │  │ Hoje | Sem | Mês | etc  │   │
│ • Pipeline                  │  └─────────────────────────┘   │
│ • Pacientes                 │                                 │
│ • Recepção                  │  ┌──────────────────────────┐  │
│ • Insights                  │  │ 💰 FATURAMENTO TOTAL      │  │
│ • Auditoria Tintim          │  │ R$ 57.000  ↑ 10%          │  │
│                              │  └──────────────────────────┘  │
│                              │                                 │
│                              │ ┌────────────────┬────────────┐│
│                              │ │ ⚠️ OPORTUNIDADES│ 👥 VENDAS  ││
│                              │ │ PARADAS        │ SEM RESP.  ││
│                              │ │ R$ 31.500      │ 15         ││
│                              │ │ 103 deals      │ R$ 4.500   ││
│                              │ └────────────────┴────────────┘│
│                              │                                 │
│                              │ 📊 KPIs MARKETING (6 Cards)    │
│                              │ ┌────────┬────────┬────────┐   │
│                              │ │Receita │Compras │Ticket  │   │
│                              │ │45K↑12%│150↓5% │300→0% │   │
│                              │ │────────┼────────┼────────│   │
│                              │ │Invest. │ROAS   │CAC     │   │
│                              │ │8K↑10% │5.6↑15%│53↓8%  │   │
│                              │ └────────┴────────┴────────┘   │
│                              │                                 │
│                              │ 📈 TOP 10 CRIATIVOS (5 Tabs)   │
│                              │ [Leads][Qualif.][Agen.][Comp.]│
│                              │ [Vendas]                       │
│                              │ ┌────────────────────────────┐ │
│                              │ │ Campanha | Inv | Leads |...│ │
│                              │ │────────────────────────────│ │
│                              │ │ PAT│HOF │ 474| 18 |... │ │
│                              │ └────────────────────────────┘ │
│                              │                                 │
│                              │ ┌────────────────────────────┐ │
│                              │ │ 📈 MINI FUNIL              │ │
│                              │ │ Leads: 726 → Qualif: 380 →│ │
│                              │ │ Agend: 190 → Comp: 150 →  │ │
│                              │ │ Vend: 120                  │ │
│                              │ └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- FilterBar (datas + filtros)
- KpiCard x6 (para cada KPI)
- CreativesTable com 5 abas (Leads, Qualificados, Agendados, Compareceram, Vendas)
- MiniFunnel
- Cards com Oportunidades Paradas e Vendas sem Responsável

**Dados**: `/api/dashboard`

---

### 📺 CAMPANHAS PAGE (/campanhas)

**Objetivo**: Listar campanhas de marketing (placeholder para futuro)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Campanhas                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Esta página será desenvolvida no futuro]                 │
│                                                              │
│  Mostrará:                                                  │
│  - Lista de campanhas ativas                               │
│  - Performance por campanha                                │
│  - Comparação temporal                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 📊 FUNIL PAGE (/funil)

**Objetivo**: Visualizar conversão detalhada em todas as etapas

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Funil de Conversão                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ LEADS                                                  │  │
│ │ 726 (100%)                                             │  │
│ │ Perdidos: 50 ❌                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                    ↓ 47.7% de perda                          │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ QUALIFICADOS                                           │  │
│ │ 380 (52.3% do total)                                   │  │
│ │ Perdidos: 30 ❌                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                    ↓ 50% de perda                            │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ AGENDADOS                                              │  │
│ │ 190 (26.2% do total)                                   │  │
│ │ Perdidos: 20 ❌                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                    ↓ 21% de perda                            │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ COMPARECERAM                                           │  │
│ │ 150 (20.7% do total)                                   │  │
│ │ Perdidos: 10 ❌                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                    ↓ 20% de perda                            │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ VENDIDOS                                               │  │
│ │ 120 (16.5% do total)                                   │  │
│ │ Sem perdas ✓                                           │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ 🔍 ANÁLISE POR CRIATIVO                                     │
│ [Tabela com Top Criativos por etapa]                       │
│                                                              │
│ 🔍 ANÁLISE POR CAMPANHA                                     │
│ [Gráfico com taxa de conversão por campanha]              │
│                                                              │
│ 📈 INSIGHTS AUTOMÁTICOS                                     │
│ • Muitas perdas em Qualificados (47.7%)                   │
│ • Taxa de conversão abaixo da meta em 3 etapas           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Funil visual (boxes com % e perdidos)
- Setas conectando etapas
- CreativesTable com análise por etapa
- Gráfico de conversão por campanha
- Card com insights

**Dados**: `/api/dashboard` (funel field) + `/api/funil-real`

---

### ⏱️ PIPELINE PAGE (/pipeline)

**Objetivo**: Agrupar deals por tempo até fechamento

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Pipeline (Deals por Tempo até Fechar)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│ │ ATÉ 7 DIAS   │  │ 8-15 DIAS    │  │ 15-30 DIAS   │       │
│ │ 45 deals     │  │ 32 deals     │  │ 28 deals     │       │
│ │ R$ 13.500    │  │ R$ 9.600     │  │ R$ 8.400     │       │
│ └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│ ┌──────────────┐                                             │
│ │ ACIMA 30D ⚠️  │                                             │
│ │ 15 deals     │                                             │
│ │ R$ 4.500     │                                             │
│ └──────────────┘                                             │
│                                                              │
│ 📊 GRÁFICO: Distribuição temporal                          │
│ [Gráfico de barras mostrando quantidade por bucket]        │
│                                                              │
│ 📋 DETALHES: Deals mais antigos (> 30 dias)               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Nome    │ Valor │ Dias │ Etapa │ Closer  │ Ação      │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Deal A  │ 5000  │ 42   │ Prop. │ João   │ Follow-up │ │
│ │ Deal B  │ 3200  │ 38   │ Demo  │ Maria  │ Contato   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- 4 Cards (Até 7d, 8-15d, 15-30d, 30d+)
- Gráfico de barras (Recharts BarChart)
- Tabela com deals > 30 dias
- Filtros por campanha/criativo/closer

**Dados**: `/api/dashboard` (pipeline field)

---

### 🔴 LEADS PARADOS PAGE (/pipeline/parados)

**Objetivo**: Visualizar deals travados há mais de 30 dias

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Leads Parados (Travados > 30 dias)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 RESUMO                                                   │
│ ┌──────────────────┬──────────────────┬──────────────────┐ │
│ │ Total Parado     │ Valor em Risco   │ % do Pipeline    │ │
│ │ 15 deals         │ R$ 4.500         │ 8.5%             │ │
│ └──────────────────┴──────────────────┴──────────────────┘ │
│                                                              │
│ 🔍 FILTROS                                                  │
│ [Campanha] [Conjunto] [Criativo] [Closer] [Min. Valor]     │
│                                                              │
│ 📋 TABELA: Deals Parados                                   │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Nome    │ Campanha │ Dias │ Valor │ Etapa │ Ação      │ ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ Deal A  │ PAT|HOF  │ 42   │ 5K    │ Prop. │ Follow-up │ ││
│ │ Deal B  │ PAT|HOF  │ 38   │ 3.2K  │ Demo  │ Contato   │ ││
│ │ ...     │ ...      │ ...  │ ...   │ ...   │ ...       │ ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ 💡 SUGESTÕES AUTOMÁTICAS                                    │
│ • Revisar 5 deals sem proposta                             │
│ • Contato urgente em 3 deals                               │
│ • Possível descarte em 2 deals (> 60 dias)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Summary cards (Total, Valor, %)
- FilterBar com múltiplos filtros
- Tabela com deals parados
- Card com sugestões de ação

**Dados**: `/api/dashboard` (revenueAtRisk field)

---

### 👥 PACIENTES PAGE (/pacientes)

**Objetivo**: Visualizar todos os pacientes/clientes cadastrados

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Pacientes / Clientes                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 RESUMO                                                   │
│ ┌──────────────────┬──────────────────┬──────────────────┐ │
│ │ Total de Pacientes│ Valor Total     │ Taxa de Conv.    │ │
│ │ 1 paciente       │ R$ 0             │ 0%               │ │
│ └──────────────────┴──────────────────┴──────────────────┘ │
│                                                              │
│ 🔍 FILTROS                                                  │
│ [Campanha] [SDR] [Closer] [Status] [Procedimento]          │
│                                                              │
│ 📋 TABELA: Todos os Pacientes                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ID │ Nome │ Tel │ Criativo │ Campanha │ Closer │ Valor │ ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ 1  │ João │ 489 │ BOTOX   │ PAT|HOF │ João │ -     │ ││
│ │ 2  │ Maria│ 489 │ Filler  │ HOT    │ Maria│ 3200  │ ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Summary cards
- FilterBar com múltiplos filtros
- Tabela com pacientes
- Ícones de status (open/closed/lost)

**Dados**: `/api/dashboard` (patients field)

---

### 📞 RECEPÇÃO PAGE (/recepcao)

**Objetivo**: KPIs e dados da recepção/atendimento

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Recepção                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 KPIs DA RECEPÇÃO                                         │
│ ┌──────────────────┬──────────────────┬──────────────────┐ │
│ │ Receita          │ Compras          │ Ticket Médio     │ │
│ │ R$ 12.000 ↑ 8%   │ 40 ↑ 5%          │ R$ 300 ↑ 2%      │ │
│ └──────────────────┴──────────────────┴──────────────────┘ │
│                                                              │
│ 📋 TABELA: Fechamentos da Recepção                         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Nome │ Tel │ Procedimento │ Valor │ Data │ Pipedrive    │ ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ Maria│ 489 │ Preenchimento│ 800   │ 14/7 │ [Link]       │ ││
│ │ João │ 489 │ Botox        │ 1200  │ 13/7 │ [Link]       │ ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ 💰 TOTAL RECEPÇÃO (MÊS): R$ 12.000                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- KpiCard x3
- Tabela com fechamentos
- Card com total do mês

**Dados**: `/api/dashboard` (recepcao field)

---

### 🔍 INSIGHTS PAGE (/insights)

**Objetivo**: Alertas automáticos e análises de negócio

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Insights & Alertas                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 🔴 ALERTAS CRÍTICOS                                         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ⚠️ ROAS está abaixo do esperado                          ││
│ │    Valor atual: 5.6x | Meta: 6.0x                       ││
│ │    → Revisar criativos com baixo ROAS                   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ⚠️ Muitas perdas em Qualificados (47.7%)                 ││
│ │    Esperado: < 30% | Atual: 47.7%                       ││
│ │    → Treinar SDRs ou revisar critério de qualificação   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ 🟡 AVISOS                                                   │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ℹ️ Pipeline > 30 dias: 15 deals em risco                ││
│ │ ℹ️ CAC aumentando (↑ 8%) → revisar custos              ││
│ │ ℹ️ 3 criativos com baixo desempenho                     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ 💡 RECOMENDAÇÕES                                            │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ✓ Aumentar investimento em Meta (5.6x ROAS)            ││
│ │ ✓ Escalar criativos de alto desempenho                 ││
│ │ ✓ Pausar criativos com ROAS < 2.0x                     ││
│ │ ✓ Fazer follow-up em 15 deals parados > 30 dias        ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Card com alerta crítico (fundo vermelho)
- Card com aviso (fundo amarelo)
- Card com recomendação (fundo azul)
- Badge com severidade

**Dados**: `/api/dashboard` (insights field)

---

### ❓ SEM ORIGEM PAGE (/sem-origem)

**Objetivo**: Visualizar leads sem origem identificada

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Leads sem Origem/Source                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 RESUMO                                                   │
│ ┌──────────────────┬──────────────────┬──────────────────┐ │
│ │ Total sem Origem │ Valor em Risco   │ % do Total       │ │
│ │ 0 leads          │ R$ 0              │ 0%               │ │
│ └──────────────────┴──────────────────┴──────────────────┘ │
│                                                              │
│ ⚠️ Leads sem origem = sem saber qual criativo/campanha    │
│    trouxe → sem como otimizar investimento               │
│                                                              │
│ 💡 Solução: Marcar manualmente ou integrar com tracker   │
│                                                              │
│ 📋 TABELA: Leads Órfãos (se houver)                       │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ID │ Nome │ Tel │ Data Entry │ Status │ Possível Orig. │ ││
│ └──────────────────────────────────────────────────────────┘│
│ (Sem dados neste período)                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Summary cards
- Alert com explicação
- Tabela (vazia se não houver dados)

**Dados**: `/api/dashboard` (leadsSemOrigem field)

---

### 🌐 OUTRAS FONTES PAGE (/outras-fontes)

**Objetivo**: Leads de canais secundários (não Google/Meta)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Outras Fontes                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 BREAKDOWN POR FONTE                                      │
│ ┌────────────────┬────────────────┬────────────────┐       │
│ │ INDICAÇÃO      │ TRÁFEGO DIRETO │ OUTROS         │       │
│ │ 85 leads       │ 25 leads       │ 15 leads       │       │
│ │ R$ 12.000      │ R$ 3.000       │ R$ 2.200       │       │
│ │ CPL: R$ 141    │ CPL: R$ 120    │ CPL: R$ 147    │       │
│ └────────────────┴────────────────┴────────────────┘       │
│                                                              │
│ 💡 INSIGHT: Indicações têm a melhor conversão e ROI       │
│            → Investir em programa de indicação             │
│                                                              │
│ 📊 GRÁFICO: Taxa de conversão por fonte                   │
│ [Gráfico de barras mostrando Conv% por fonte]             │
│                                                              │
│ 📋 TABELA: Detalhes por Fonte                             │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Fonte      │ Leads │ Conv.% │ Receita │ ROI             │ ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ Indicação  │ 85    │ 24%    │ 12.000  │ ∞ (sem custo)   │ ││
│ │ Tráfego    │ 25    │ 20%    │ 3.000   │ 8.0x            │ ││
│ │ Outros     │ 15    │ 15%    │ 2.200   │ 6.0x            │ ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Cards com cada fonte
- Gráfico de barras (Recharts)
- Tabela com breakdown

**Dados**: `/api/dashboard` (leadSources field)

---

### 🔎 AUDITORIA TINTIM PAGE (/auditoria-tintim)

**Objetivo**: Verificar qualidade de dados e sugerir preenchimento

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Auditoria Tintim (Verificação de Dados)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 RESUMO                                                   │
│ ┌──────────────┬──────────────┬──────────────┐             │
│ │ Analisados   │ Incompletos  │ Sem Track    │             │
│ │ 15 deals     │ 8            │ 3            │             │
│ │             │ 53%          │ 20%          │             │
│ └──────────────┴──────────────┴──────────────┘             │
│                                                              │
│ 🟢 CRITICIDADE: 🟢 OK | 🟡 Aviso | 🔴 Crítico              │
│                                                              │
│ 📋 TABELA: Verificação de Campos                           │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Deal  │ Status │ Campos Faltando │ Sugestão │ Ação      │ ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ #1    │ 🔴 Crít.│ [campanha]     │ PAT|HOF  │ ✓ Aplicar │ ││
│ │       │        │ [conjunto]     │ QUENTE   │ ✓ Aplicar │ ││
│ │       │        │ [palavra-chave]│ BOTOX    │ ✓ Aplicar │ ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ #2    │ 🟡 Avis.│ [origem]       │ Google   │ ✓ Aplicar │ ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ✅ APLICAR TUDO                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Componentes**:
- Summary cards com status
- Tabela com campos faltando
- Badge de criticidade (cores)
- Botão para aplicar sugestões

**Dados**: `/api/tintim-audit` + POST `/api/tintim-audit/apply`

---

### 📺 REUNIÃO PAGE (/reuniao)

**Objetivo**: Dashboard em tela cheia para projetor/TV em reunião

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 INSIGHTS VIVERA - REUNIÃO                                │
│                                                              │
│ FATURAMENTO TOTAL: R$ 57.000 ↑ 10%                         │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ⚠️ OPORTUNIDADES PARADAS                              │   │
│ │    R$ 31.500 | 103 deals                              │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 📈 FUNIL CONVERSÃO                                      │  │
│ │ [Gráfico grande do funil]                              │  │
│ │ Leads: 726 → Qualif: 380 → Agend: 190 → Vend: 120   │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌──────────────────┬──────────────────┬──────────────────┐  │
│ │ 💰 Receita       │ 📊 ROAS          │ 💵 CAC           │  │
│ │ R$ 45.000        │ 5.6x             │ R$ 53            │  │
│ │ ↑ 12.5%          │ ↑ 15%            │ ↓ 8%             │  │
│ └──────────────────┴──────────────────┴──────────────────┘  │
│                                                              │
│ 🎨 TOP 5 CRIATIVOS (Performance)                           │
│ [Tabela com top criativos]                                 │
│                                                              │
│ 🕐 Atualizado em: 14/07/2026 10:30:45                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Características**:
- Sem menu lateral (mais espaço)
- Fonte grande (visualização em TV)
- Atualiza automaticamente a cada 30 segundos
- Modo escuro por padrão
- Componentes principais apenas

**Dados**: `/api/dashboard`

---

## 🔄 FLUXO DE DADOS {#fluxo}

### Fluxo de Inicialização

```
1. [App monta]
   ↓
2. [FilterProvider inicializa com data do mês atual]
   ↓
3. [useEffect dispara fetchDashboard(since, until)]
   ↓
4. [client.ts envia GET /api/dashboard?since=...&until=...]
   ↓
5. [Vercel Function recebe query params]
   ↓
6. [Backend query dados do período (mock ou DB real)]
   ↓
7. [Backend retorna DashboardResponse JSON]
   ↓
8. [FilterContext recebe dados e atualiza state]
   ↓
9. [Components observam FilterContext e renderizam]
   ↓
10. [Usuário vê dashboard com dados atuais]
```

### Fluxo de Filtros

```
Usuário muda data range
         ↓
   setRange() chamado
         ↓
   [since, until] atualiza
         ↓
   useEffect dispara novo fetchDashboard
         ↓
   Componentes renderizam com novos dados
```

### Fluxo de Filtros Secundários

```
Usuário seleciona filtro (ex: campanha específica)
         ↓
   setFilter('campanha', 'PAT|HOF')
         ↓
   filteredCreatives computed (fil trados localmente)
         ↓
   Componentes renderizam apenas dados filtrados
         ↓
   Nota: Não recarrega API, apenas filtra no cliente
```

---

## 📱 RESPONSIVIDADE {#responsividade}

### Breakpoints

```
Mobile (< 640px):
  - Menu lateral desaparece
  - MobileNav aparece (hamburger menu)
  - Cards em coluna única
  - Tabelas scroll horizontal
  - Fonte reduzida

Tablet (640px - 1024px):
  - Sidebar colapsada
  - 2 cards por linha
  - Tabelas visíveis com scroll

Desktop (1024px+):
  - Sidebar completa
  - Layout lado a lado
  - Tabelas com scroll automático
  - Todos componentes visíveis
```

### Comportamentos Responsivos

**HomePage**:
- Mobile: Cards em coluna, tabelas com scroll
- Tablet: Cards em coluna dupla
- Desktop: Layout padrão

**FunilPage**:
- Mobile: Boxes em coluna
- Tablet/Desktop: Layout horizontal

**Tabelas**:
- Mobile: Scroll horizontal, ocultar colunas menos importantes
- Desktop: Todas as colunas visíveis

---

## 🎭 DARK MODE

- Toggle no header
- Preferência salva em localStorage
- Transição suave entre cores
- Contraste adequado em ambos modos
- Sistema de cores bem definido (vide Design System)

---

## ⚙️ INTEGRAÇÃO EXTERNA (REAL)

Quando implementar integrações reais, os endpoints devem conectar:

1. **Pipedrive API** - Dados de deals/pessoas
2. **Google Ads API** - Dados de campanhas Google
3. **Meta Ads API** - Dados de campanhas Facebook/Instagram
4. **Banco de Dados** - Armazenar leads/pacientes/auditoria

---

## 📋 CHECKLIST PARA REPRODUZIR NO FIGMA

- [ ] Criar projeto no Figma
- [ ] Definir cores (vide Paleta de Cores)
- [ ] Importar tipografia Inter
- [ ] Criar componentes base:
  - [ ] KPI Card
  - [ ] Table Cell
  - [ ] Button
  - [ ] Badge/Pill
  - [ ] Card Container
- [ ] Desenhar cada página (vide Cada Página Detalhada)
- [ ] Criar variações de estado (hover, active, disabled)
- [ ] Fazer versão mobile (breakpoint 640px)
- [ ] Fazer versão dark mode
- [ ] Criar componentes de erro/loading
- [ ] Preparar para prototipagem interativa

---

**Fim da Documentação**

Criado em: 17/07/2026
Atualizado em: 17/07/2026
