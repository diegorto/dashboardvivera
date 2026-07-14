import { useState } from 'react'
import { useFilters } from '@/lib/FilterContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL, formatNumber, cn } from '@/lib/utils'
import type { PipelineBucket } from '@/api/types'

const HOT_LABELS = new Set(['15-21 dias', '22-30 dias', '30+ dias'])

export function PipelinePage() {
  const { data } = useFilters()
  const [openBucket, setOpenBucket] = useState<PipelineBucket | null>(null)
  if (!data) return null

  const pipeline = data.pipeline

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Pipeline</h1>
      <p className="text-xs text-muted-foreground -mt-2">Envelhecimento de todos os negócios em aberto no funil Inbound (não é limitado pelo período selecionado — mostra o backlog atual).</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {pipeline.buckets.map(b => (
          <button key={b.label} onClick={() => setOpenBucket(b)} className="text-left">
            <Card className={cn(HOT_LABELS.has(b.label) && 'border-critical/40 bg-critical-soft/40')}>
              <CardContent className="flex flex-col gap-1 p-3.5">
                <span className={cn('text-[11px] font-medium uppercase tracking-wide', HOT_LABELS.has(b.label) ? 'text-critical' : 'text-muted-foreground')}>{b.label}</span>
                <span className="text-lg font-bold tabular-nums">{formatNumber(b.count)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatBRL(b.potentialValue)}</span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {openBucket && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Negócios — {openBucket.label}</CardTitle>
            <button onClick={() => setOpenBucket(null)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {openBucket.deals.length === 0 && <li className="py-2 text-xs text-muted-foreground">Nenhum negócio nesta faixa.</li>}
              {openBucket.deals.map(d => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{d.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.days} dias · {d.anuncio}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Criativos com mais leads parados (15+ dias)</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {pipeline.stuckCreatives.length === 0 && <li className="text-xs text-muted-foreground">Nada parado — bom sinal.</li>}
              {pipeline.stuckCreatives.map(c => (
                <li key={c.anuncio} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.anuncio}</span>
                  <span className="tabular-nums font-semibold">{c.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Campanhas com maior tempo médio</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {pipeline.slowestCampaigns.map(c => (
                <li key={c.campanha} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.campanha}</span>
                  <span className="tabular-nums font-semibold">{c.avgDays.toFixed(0)}d</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
