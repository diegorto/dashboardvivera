import { useState } from 'react'
import { useFilters } from '@/lib/FilterContext'
import { formatNumber, formatPercent } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function FunilPage() {
  const { data } = useFilters()
  const [selected, setSelected] = useState<string | null>(null)
  if (!data) return null

  const funnel = data.funnel
  const max = funnel.stages[0]?.count || 1
  const selectedStage = funnel.stages.find(s => s.key === selected)
  const topCreatives = selected ? funnel.topCreativesByStage[selected] || [] : []

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">Funil</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2.2fr_1fr]">
        <Card>
          <CardContent className="flex flex-col gap-5 p-5">
            {funnel.stages.map((stage, i) => (
              <button
                key={stage.key}
                onClick={() => setSelected(stage.key === selected ? null : stage.key)}
                className="group flex flex-col gap-1.5 text-left"
              >
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-semibold ${selected === stage.key ? 'text-accent' : ''}`}>{stage.label}</span>
                  <span className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-base font-bold">{formatNumber(stage.count)}</span>
                    <span className="text-xs text-muted-foreground">{formatPercent(stage.pctFromStart, 0)}</span>
                    {stage.pctLossFromPrev !== null && (
                      <span className="text-xs font-medium text-critical">({stage.pctLossFromPrev.toFixed(0)}%)</span>
                    )}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className={`h-3 rounded-full transition-all ${selected === stage.key ? 'bg-accent' : 'bg-accent/60 group-hover:bg-accent/80'}`}
                    style={{ width: `${Math.max(3, (stage.count / max) * 100)}%` }}
                  />
                </div>
                {i < funnel.stages.length - 1 && <div className="h-px" />}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedStage ? `Top 5 criativos — ${selectedStage.label}` : 'Drill-down'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedStage && <p className="text-xs text-muted-foreground">Clique numa etapa do funil pra ver os criativos que mais contribuem para ela.</p>}
            {selectedStage && topCreatives.length === 0 && <p className="text-xs text-muted-foreground">Sem dados nesta etapa no período.</p>}
            <ul className="flex flex-col gap-2">
              {topCreatives.map(c => (
                <li key={c.anuncio} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.anuncio}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatPercent(c.pct, 0)} · {c.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Etapas aproximadas pela posição atual do negócio no Pipedrive (o Pipedrive não guarda histórico de passagem por etapa via API padrão). Vendas (status ganho) contam como tendo alcançado no mínimo a etapa de Comparecimento.
      </p>
    </div>
  )
}
