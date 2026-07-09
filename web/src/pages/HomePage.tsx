import { AlertTriangle, UserX } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { KpiCard } from '@/components/KpiCard'
import { CreativesTable } from '@/components/CreativesTable'
import { MiniFunnel } from '@/components/MiniFunnel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL, formatNumber } from '@/lib/utils'

export function HomePage() {
  const { data, filteredCreatives } = useFilters()
  if (!data) return null

  const top10 = [...filteredCreatives].sort((a, b) => b.receita - a.receita).slice(0, 10)
  const worst10 = [...filteredCreatives]
    .filter(c => c.investimento > 0)
    .sort((a, b) => a.roas - b.roas)
    .slice(0, 10)

  const risk = data.revenueAtRisk

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <Card className="border-critical/30 bg-critical-soft/40">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <AlertTriangle className="h-4 w-4 text-critical" />
            <CardTitle className="text-critical">Receita em Risco</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-2xl font-bold tabular-nums text-critical">{formatBRL(risk.total)}</div>
              <div className="text-xs text-muted-foreground">valor do negócio quando definido, senão ticket médio do período</div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <RiskLine label="Qualificados sem agendamento" count={risk.qualificadosSemAgendamento.count} value={risk.qualificadosSemAgendamento.value} />
              <RiskLine label="Agendados que faltaram" count={risk.agendadosFaltaram.count} value={risk.agendadosFaltaram.value} />
              <RiskLine label="Compareceram sem fechar" count={risk.propostasSemFechamento.count} value={risk.propostasSemFechamento.value} />
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

function RiskLine({ label, count, value }: { label: string; count: number; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold tabular-nums">{count} <span className="font-normal text-muted-foreground">· {formatBRL(value)}</span></span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
