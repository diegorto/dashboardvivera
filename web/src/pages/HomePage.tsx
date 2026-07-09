import { AlertTriangle, UserX, Landmark } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { KpiCard } from '@/components/KpiCard'
import { CreativesTable } from '@/components/CreativesTable'
import { MiniFunnel } from '@/components/MiniFunnel'
import { DeltaIndicator } from '@/components/DeltaIndicator'
import { StuckDealsGroup } from '@/components/StuckDealsGroup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL, formatNumber, formatDate } from '@/lib/utils'

export function HomePage() {
  const { data, filteredCreatives } = useFilters()
  if (!data) return null

  const top10 = [...filteredCreatives].sort((a, b) => b.receita - a.receita).slice(0, 10)
  const worst10 = [...filteredCreatives]
    .filter(c => c.investimento > 0)
    .sort((a, b) => a.roas - b.roas)
    .slice(0, 10)

  const risk = data.revenueAtRisk
  const stuckCount = risk.qualificadosSemAgendamento.count + risk.agendadosFaltaram.count + risk.propostasSemFechamento.count

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-accent/30 bg-accent-soft/30">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Landmark className="h-4 w-4 text-accent" />
          <CardTitle className="text-accent">Faturamento Total da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tabular-nums">{formatBRL(data.faturamentoTotal.current)}</span>
            <DeltaIndicator deltaPct={data.faturamentoTotal.deltaPct} />
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
            <span>Marketing (Meta Ads): <span className="font-semibold text-foreground">{formatBRL(data.kpis.receita.current)}</span></span>
            <span>Recepção: <span className="font-semibold text-foreground">{formatBRL(data.recepcao.kpis.receita.current)}</span></span>
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
                {stuckCount} negócios parados que poderiam gerar a receita estimada pelo ticket médio das vendas de Marketing (Meta Ads) fechadas no período selecionado, {formatDate(data.range.since)} a {formatDate(data.range.until)} (tkm médio do período: {formatBRL(data.kpis.ticketMedio.current)})
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Receita" metric={data.kpis.receita} format={formatBRL} />
        <KpiCard label="Compras" metric={data.kpis.compras} format={formatNumber} />
        <KpiCard label="Ticket Médio" metric={data.kpis.ticketMedio} format={formatBRL} />
        <KpiCard label="Investimento" metric={data.kpis.investimento} format={formatBRL} invert />
        <KpiCard label="ROAS" metric={data.kpis.roas} format={n => `${n.toFixed(2)}x`} />
        <KpiCard label="CAC" metric={data.kpis.cac} format={formatBRL} invert />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Criativos</h2>
        <CreativesTable rows={top10} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Top 10 Piores</h2>
        <CreativesTable rows={worst10} />
      </section>

      <MiniFunnel funnel={data.funnel} />
    </div>
  )
}
