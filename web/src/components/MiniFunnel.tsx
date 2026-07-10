import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { Funnel } from '@/api/types'

export function MiniFunnel({ funnel }: { funnel: Funnel }) {
  const max = funnel.stages[0]?.count || 1
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Funil</CardTitle>
        <Link to="/funil" className="text-xs font-medium text-accent hover:underline">Ver completo (real) →</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-[11px] text-muted-foreground">Prévia rápida pela posição atual do negócio. A aba Funil mostra o histórico real de cada etapa.</p>
        {funnel.stages.map(stage => (
          <div key={stage.key} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs font-medium">{stage.label}</div>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(4, (stage.count / max) * 100)}%` }} />
            </div>
            <div className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatNumber(stage.count)}</div>
            <div className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">{formatPercent(stage.pctFromStart, 0)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
