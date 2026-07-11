import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn, formatPercent } from '@/lib/utils'

export function DeltaIndicator({ deltaPct, invert = false }: { deltaPct: number | null; invert?: boolean }) {
  if (deltaPct === null) {
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">— novo</span>
  }
  const isFlat = Math.abs(deltaPct) < 0.05
  const isUp = deltaPct > 0
  const good = isFlat ? null : invert ? !isUp : isUp

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
        isFlat && 'text-muted-foreground',
        good === true && 'text-good',
        good === false && 'text-critical'
      )}
    >
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {formatPercent(Math.abs(deltaPct))}
    </span>
  )
}
