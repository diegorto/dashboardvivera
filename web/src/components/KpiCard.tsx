import { Card, CardContent } from '@/components/ui/card'
import { DeltaIndicator } from '@/components/DeltaIndicator'
import type { Metric } from '@/api/types'

export function KpiCard({ label, metric, format, invert }: { label: string; metric: Metric; format: (n: number) => string; invert?: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-3.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-lg font-bold tabular-nums leading-none">{format(metric.current)}</span>
        <DeltaIndicator deltaPct={metric.deltaPct} invert={invert} />
      </CardContent>
    </Card>
  )
}
