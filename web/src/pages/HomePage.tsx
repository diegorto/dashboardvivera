import { AlertTriangle, UserX, Landmark, Users, HeartHandshake, HelpCircle } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { KpiCard } from '@/components/KpiCard'
import { CreativesTable } from '@/components/CreativesTable'
import { LostCreativesTable } from '@/components/LostCreativesTable'
import { MiniFunnel } from '@/components/MiniFunnel'
import { DeltaIndicator } from '@/components/DeltaIndicator'
import { StuckDealsGroup } from '@/components/StuckDealsGroup'
import { SalesGroup, type SalesGroupItem } from '@/components/SalesGroup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL, formatNumber, formatDate } from '@/lib/utils'
import type { Creative } from '@/api/types'

function top10By(rows: Creative[], key: keyof Creative) {
  return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 10)
}

export function HomePage() {
  const { data, filteredCreatives } = useFilters()
  if (!data) return null

  const topLeads = top10By(filteredCreatives, 'leads')
  const topQualificados = top10By(filteredCreatives, 'qualificados')
  const topAgendados = top10By(filteredCreatives, 'agendados')
  const topCompareceram = top10By(filteredCreatives, 'compareceram')
  const topReceita = top10By(filteredCreatives, 'receita')

  const risk = data.revenueAtRisk
  const stuckCount = risk.qualificadosSemAgendamento.count + risk.agendadosFaltaram.count + risk.propostasSemFechamento.count
  const semOrcamentoCount = risk.qualificadosSemAgendamento.semOrcamento + risk.agendadosFaltaram.semOrcamento + risk.propostasSemFechamento.semOrcamento

  const mktSalesItems: SalesGroupItem[] = data.patients
    .filter(p => p.campanha !== 'sem_campanha')
    .map(p => ({ id: p.id, nome: p.nome, telefone: p.telefone, valor: p.valor, origem: `${p.campanha} · ${p.criativo}`, pipedriveUrl: p.pipedriveUrl }))

  const recepcaoSalesItems: SalesGroupItem[] = data.recepcao.fechamentos
    .map(f => ({ id: f.id, nome: f.nome, telefone: f.telefone, valor: f.valor, origem: f.procedimento, pipedriveUrl: f.pipedriveUrl }))

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-accent/30 bg-accent-soft/30">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Landmark className="h-4 w-4 text-accent" />
          <CardTitle className="text-accent">Faturamento Total da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tabular-nums">{formatBRL(data.faturamentoTotal.current)}</span>
            <DeltaIndicator deltaPct={data.faturamentoTotal.deltaPct} />
          </div>
          <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-8">
            <SalesGroup label="Receita vindo do MKT" total={data.kpis.receita.current} items={mktSalesItems} />
            <SalesGroup label="Recepção" total={data.recepcao.kpis.receita.current} items={recepcaoSalesItems} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <Card className="border-critical/30 bg-critical-soft/40">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <AlertTriangle className="h-4 w-4 text-critical" />
            <CardTitle className="text-critical">Oportunidades Paradas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <div className="text-2xl font-bold tabular-nums text-critical">{formatBRL(risk.total)}</div>
              <div className="text-xs text-muted-foreground">
                {stuckCount} negócios parados nos últimos 3 meses ({formatDate(data.revenueAtRiskRange.since)} a {formatDate(data.revenueAtRiskRange.until)}), somando só o orçamento real já registrado no Pipedrive — sem estimativa. Independente do filtro de período selecionado acima.
                {semOrcamentoCount > 0 && <span> {semOrcamentoCount} desses negócios ainda não têm valor definido no Pipedrive, então não entram nessa soma.</span>}
              </div>
            </div>
            <div className="flex flex-col gap-3 text-xs sm:flex-row sm:flex-wrap sm:gap-8">
              <StuckDealsGroup label="Qualificados sem agendamento" group={risk.qualificadosSemAgendamento} />
              <StuckDealsGroup label="Agendados que faltaram" group={risk.agendadosFaltaram} />
              <StuckDealsGroup label="Compareceram sem fechar" group={risk.propostasSemFechamento} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-critical/30 bg-critical-soft/40">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <UserX className="h-4 w-4 text-critical" />
            <CardTitle className="text-critical">Vendas sem Responsável</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-critical">{data.governance.semResponsavel.count}</div>
            <div className="text-xs text-muted-foreground">{formatBRL(data.governance.semResponsavel.value)} sem etiqueta de Closer</div>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Receita proveniente do Marketing</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <KpiCard label="Receita" metric={data.kpis.receita} format={formatBRL} />
          <KpiCard label="Compras" metric={data.kpis.compras} format={formatNumber} />
          <KpiCard label="Ticket Médio" metric={data.kpis.ticketMedio} format={formatBRL} />
          <KpiCard label="Investimento" metric={data.kpis.investimento} format={formatBRL} invert />
          <KpiCard label="ROAS" metric={data.kpis.roas} format={n => `${n.toFixed(2)}x`} />
          <KpiCard label="CAC" metric={data.kpis.cac} format={formatBRL} invert />
          <KpiCard label="Tempo Lead → Venda" metric={data.kpis.tempoLeadParaVenda} format={n => `${n.toFixed(1)}d`} invert />
          <KpiCard label="Tempo Orçamento → Venda" metric={data.kpis.tempoOrcamentoParaVenda} format={n => `${n.toFixed(1)}d`} invert />
        </div>
      </section>

      {data.leadSources && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Leads por Fonte</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <SourceCard
              icon={<Users className="h-4 w-4 text-blue-600" />}
              label="Total de Leads"
              leads={data.leadSources.total.leads}
              receita={data.leadSources.total.receita}
            />
            <SourceCard
              icon={<GoogleIcon />}
              label="Google"
              leads={data.leadSources.google.leads}
              cpl={data.leadSources.google.cpl}
              receita={data.leadSources.google.receita}
            />
            <SourceCard
              icon={<MetaIcon />}
              label="Instagram / Meta"
              leads={data.leadSources.meta.leads}
              cpl={data.leadSources.meta.cpl}
              receita={data.leadSources.meta.receita}
            />
            <SourceCard
              icon={<HeartHandshake className="h-4 w-4 text-rose-500" />}
              label="Indicação"
              leads={data.leadSources.indicacao.leads}
              receita={data.leadSources.indicacao.receita}
            />
            <SourceCard
              icon={<HelpCircle className="h-4 w-4 text-slate-400" />}
              label="Outras Fontes"
              leads={data.leadSources.outros.leads}
              receita={data.leadSources.outros.receita}
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos — Leads Recebidos</h2>
        <CreativesTable rows={topLeads} defaultSortKey="leads" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos — Leads Qualificados</h2>
        <CreativesTable rows={topQualificados} defaultSortKey="qualificados" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos — Leads Agendados</h2>
        <CreativesTable rows={topAgendados} defaultSortKey="agendados" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos — Leads Comparecidos</h2>
        <CreativesTable rows={topCompareceram} defaultSortKey="compareceram" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos — Vendas em R$ Ganhas</h2>
        <CreativesTable rows={topReceita} defaultSortKey="receita" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos — Perdidos</h2>
        <LostCreativesTable rows={filteredCreatives} />
      </section>

      <MiniFunnel funnel={data.funnel} />
    </div>
  )
}

function SourceCard({ icon, label, leads, cpl, receita }: {
  icon: React.ReactNode
  label: string
  leads: number
  cpl?: number | null
  receita: number
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
        <span className="text-2xl font-bold tabular-nums">{formatNumber(leads)}</span>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {cpl !== undefined && (
            <span>CPL: <span className="font-semibold text-foreground">{cpl === null ? '—' : formatBRL(cpl)}</span></span>
          )}
          <span>Receita: <span className="font-semibold text-foreground">{formatBRL(receita)}</span></span>
        </div>
      </CardContent>
    </Card>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function MetaIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-label="Meta">
      <path fill="#0081FB" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </svg>
  )
}
