export type CreativeStatus = 'escalar' | 'observar' | 'desligar'

export interface Metric {
  current: number
  previous: number
  deltaPct: number | null
}

export interface Kpis {
  receita: Metric
  compras: Metric
  ticketMedio: Metric
  investimento: Metric
  roas: Metric
  cac: Metric
}

export interface Creative {
  campanha: string
  conjunto: string
  anuncio: string
  investimento: number
  leads: number
  qualificados: number
  agendados: number
  compareceram: number
  compras: number
  receita: number
  roas: number
  receitaPorLead: number
  receitaPorAgendamento: number
  ctr: number
  cpc: number
  impressoes: number
  cliques: number
  trend: number[]
  trendDirection: 'up' | 'down' | 'flat'
  status: CreativeStatus
  thumbnailUrl: string | null
  adUrl: string | null
  adStatus: string | null
  adId: string | null
}

export interface FunnelStage {
  key: string
  label: string
  count: number
  pctFromStart: number
  pctLossFromPrev: number | null
}

export interface FunnelTopCreative {
  anuncio: string
  count: number
  pct: number
}

export interface Funnel {
  stages: FunnelStage[]
  topCreativesByStage: Record<string, FunnelTopCreative[]>
}

export interface PipelineDealRef {
  id: number
  title: string
  days: number
  anuncio: string
  campanha: string
}

export interface PipelineBucket {
  label: string
  count: number
  potentialValue: number
  deals: PipelineDealRef[]
}

export interface Pipeline {
  buckets: PipelineBucket[]
  stuckCreatives: { anuncio: string; count: number }[]
  slowestCampaigns: { campanha: string; avgDays: number; count: number }[]
}

export interface Patient {
  id: number
  nome: string
  telefone: string
  criativo: string
  campanha: string
  conjunto: string
  closer: string | null
  sdr: string
  procedimento: string
  valor: number
  dataLead: string
  dataVenda: string | null
  status: string
  tempoAteFechar: number | null
}

export interface Governance {
  totalVendas: number
  comResponsavel: number
  semResponsavel: {
    count: number
    value: number
    deals: { id: number; title: string; value: number; data: string | null }[]
  }
}

export interface Insight {
  id: string
  severity: 'neutral' | 'good' | 'critical'
  text: string
}

export interface RevenueAtRiskDeal {
  id: number
  title: string
  status: string
  value: number
}

export interface RevenueAtRiskGroup {
  count: number
  value: number
  deals: RevenueAtRiskDeal[]
}

export interface RevenueAtRisk {
  qualificadosSemAgendamento: RevenueAtRiskGroup
  agendadosFaltaram: RevenueAtRiskGroup
  propostasSemFechamento: RevenueAtRiskGroup
  total: number
}

export interface LeadSemOrigem {
  id: number
  nome: string
  campanha: string | null
  conjunto: string | null
  etapa: string
  responsavel: string
  dataEntrada: string
  status: string
}

export interface DashboardResponse {
  success: boolean
  range: { since: string; until: string }
  previousRange: { since: string; until: string }
  kpis: Kpis
  creatives: Creative[]
  funnel: Funnel
  pipeline: Pipeline
  patients: Patient[]
  governance: Governance
  revenueAtRisk: RevenueAtRisk
  insights: Insight[]
  leadsSemOrigem: LeadSemOrigem[]
  meta: { adsAccounts: number; totalAdsComGasto: number; totalDealsNoPeriodo: number }
  error?: string
}
