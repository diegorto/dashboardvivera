import { AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { cn } from '@/lib/utils'
import type { Insight } from '@/api/types'

export function InsightsPage() {
  const { data } = useFilters()
  if (!data) return null

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">Insights</h1>
      <div className="flex flex-col gap-2">
        {data.insights.length === 0 && <p className="text-sm text-muted-foreground">Sem insights suficientes pro período selecionado.</p>}
        {data.insights.map(i => <InsightCard key={i.id} insight={i} />)}
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: Insight }) {
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
