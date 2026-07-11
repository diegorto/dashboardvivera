import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import type { SortDir } from '@/lib/useSort'

export function SortHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'right'
}) {
  return (
    <TableHead onClick={onClick} className={align === 'right' ? 'text-right' : undefined}>
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {active && dir === 'asc' && <ArrowUp className="h-3 w-3" />}
        {active && dir === 'desc' && <ArrowDown className="h-3 w-3" />}
        {!active && <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </TableHead>
  )
}
