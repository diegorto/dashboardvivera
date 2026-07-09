import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp, Info, ArrowRight } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { cn } from '@/lib/utils'
import type { Insight } from '@/api/types'

const INSIGHT_LINKS: Record<string, { label: string; to: string }> = {
  'pipeline-parado': { label: 'Ver lista completa e exportar XLS', to: '/pipeline/parados' },
}

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
  const link = INSIGHT_LINKS[insight.id]

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-sm',
        insight.severity === 'critical' && 'border-critical/30 bg-critical-soft/50 text-critical',
        insight.severity === 'good' && 'border-good/30 bg-good-soft/50 text-good',
        insight.severity === 'neutral' && 'border-border bg-card'
      )}
    >
      {link && (
        <Link to={link.to} className="inline-flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline">
          {link.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className={insight.severity === 'neutral' ? 'text-foreground' : ''}>{insight.text}</span>
      </div>
    </div>
  )
}
