import { Badge } from '@/components/ui/badge'
import type { CreativeStatus } from '@/api/types'

const CONFIG: Record<CreativeStatus, { label: string; variant: 'good' | 'warn' | 'critical' }> = {
  escalar: { label: 'Escalar', variant: 'good' },
  observar: { label: 'Observar', variant: 'warn' },
  desligar: { label: 'Desligar', variant: 'critical' },
}

export function StatusPill({ status }: { status: CreativeStatus }) {
  const c = CONFIG[status]
  return (
    <Badge variant={c.variant} dot>
      {c.label}
    </Badge>
  )
}
