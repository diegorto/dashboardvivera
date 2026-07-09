import { useState } from 'react'
import { ChevronRight, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { formatNumber, formatPercent, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Insight } from '@/api/types'

export function FunilPage() {
  const { data } = useFilters()
  const [selected, setSelected] = useState<string | null>(null)
  if (!data) return null

  const funnel = data.funnel
  const max = funnel.stages[0]?.count || 1
  const selectedStage = funnel.stages.find(s => s.key === selected)
  const topCreatives = selected ? funnel.topCreativesByStage[selected] || [] : []

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Funil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Evolução do funil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 overflow-x-auto pb-1">
            {funnel.stages.map((stage, i) => (
              <div key={stage.key} className="flex items-end">
                <button
                  onClick={() => setSelected(stage.key === selected ? null : stage.key)}
                  className={cn(
                    'flex w-32 shrink-0 flex-col items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted',
                    selected === stage.key && 'bg-accent-soft'
                  )}
                >
                  <div className="text-center">
                    <div className="text-base font-bold tabular-nums">{formatNumber(stage.count)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatPercent(stage.pctFromStart, 0)}
                      {stage.pctLossFromPrev !== null && <span className="text-critical"> ({stage.pctLossFromPrev.toFixed(0)}%)</span>}
                    </div>
                  </div>
                  <div className="flex h-32 w-full flex-col-reverse overflow-hidden rounded-md bg-muted">
                    <div className={cn('w-full', selected === stage.key ? 'bg-accent' : 'bg-accent/70')} style={{ height: `${Math.max(stage.count > 0 ? 4 : 0, ((stage.count - stage.perdidos) / max) * 100)}%` }} />
                    {stage.perdidos > 0 && (
                      <div className="w-full bg-critical" style={{ height: `${(stage.perdidos / max) * 100}%` }} />
                    )}
                  </div>
                  <div className={cn('text-xs font-semibold', selected === stage.key && 'text-accent')}>{stage.label}</div>
                  {stage.perdidos > 0 && <div className="text-[11px] text-critical">{stage.perdidos} perdidos</div>}
                  {stage.objecoes.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1">
                      {stage.objecoes.slice(0, 2).map(o => (
                        <Badge key={o.tag} variant="critical" className="text-[9px]">{o.tag} ({o.count})</Badge>
                      ))}
                    </div>
                  )}
                </button>
                {i < funnel.stages.length - 1 && <ChevronRight className="mb-16 h-5 w-5 shrink-0 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Etapas aproximadas pela posição atual do negócio no Pipedrive (o Pipedrive não guarda histórico de passagem por etapa via API padrão). Vendas (status ganho) contam como tendo alcançado no mínimo a etapa de Comparecimento. A barra vermelha mostra quantos dos que chegaram na etapa acabaram perdidos, com os motivos mais comuns.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selectedStage ? `Top 5 criativos — ${selectedStage.label}` : 'Drill-down'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedStage && <p className="text-xs text-muted-foreground">Clique numa etapa do funil acima pra ver os criativos que mais contribuem para ela.</p>}
          {selectedStage && topCreatives.length === 0 && <p className="text-xs text-muted-foreground">Sem dados nesta etapa no período.</p>}
          <ul className="flex flex-col gap-2.5">
            {topCreatives.map(c => (
              <li key={c.anuncio} className="flex items-start justify-between gap-2 text-sm">
                <span>
                  {c.anuncio}
                  {(c.campanha || c.conjunto) && (
                    <span className="text-xs text-muted-foreground"> ({c.campanha} / {c.conjunto})</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatPercent(c.pct, 0)} · {c.count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insights do funil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {funnel.insights.length === 0 && <p className="text-xs text-muted-foreground">Sem insights suficientes pro período selecionado.</p>}
          {funnel.insights.map(i => <FunnelInsightRow key={i.id} insight={i} />)}
        </CardContent>
      </Card>
    </div>
  )
}

function FunnelInsightRow({ insight }: { insight: Insight }) {
  const Icon = insight.severity === 'critical' ? AlertTriangle : insight.severity === 'good' ? TrendingUp : Info
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        insight.severity === 'critical' && 'border-critical/30 bg-critical-soft/50 text-critical',
        insight.severity === 'good' && 'border-good/30 bg-good-soft/50 text-good',
        insight.severity === 'neutral' && 'border-border bg-card'
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className={insight.severity === 'neutral' ? 'text-foreground' : ''}>{insight.text}</span>
    </div>
  )
}
