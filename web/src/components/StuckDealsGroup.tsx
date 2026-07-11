import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, MessageCircle } from 'lucide-react'
import { formatBRL, whatsappUrl } from '@/lib/utils'
import type { RevenueAtRiskGroup } from '@/api/types'

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr);
  const today = new Date();
  const diffMs = today.getTime() - date.getTime();
  return Math.floor(diffMs / 86400000);
}

function formatDays(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'hoje';
  if (days === 1) return '1 dia';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}s`;
  return `${Math.floor(days / 30)}m`;
}

export function StuckDealsGroup({ label, group }: { label: string; group: RevenueAtRiskGroup }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => setOpen(o => !o)} className="flex flex-col items-start text-left hover:opacity-80" disabled={group.count === 0}>
        <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
          {group.count > 0 && (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
          {group.count} <span className="font-normal text-muted-foreground">· {formatBRL(group.value)}</span>
        </span>
        <span className="text-muted-foreground">
          {label}
          {group.semOrcamento > 0 && <span className="text-warn"> ({group.semOrcamento} sem orçamento)</span>}
        </span>
      </button>

      {open && group.deals.length > 0 && (
        <div className="ml-1 mt-0.5 flex flex-col gap-2 border-l border-border pl-3">
          {group.deals.map(d => {
            const wa = whatsappUrl(d.telefone)
            const diasEntrada = daysAgo(d.dataEntrada);
            const diasParado = daysAgo(d.dataUltimaMudanca);
            return (
              <div key={d.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <a
                    href={d.pipedriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                  >
                    {d.title} <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className={d.value > 0 ? 'text-[11px] font-semibold text-foreground' : 'text-[11px] italic text-warn'}>
                    {d.value > 0 ? formatBRL(d.value) : 'sem orçamento'}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-good hover:underline">
                      <MessageCircle className="h-3 w-3" /> {d.telefone}
                    </a>
                  ) : (
                    'sem telefone'
                  )}
                  {' · '}{d.campanha} · {d.criativo}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Entrada: {formatDays(daysAgo(d.dataEntrada))} · Parado: {formatDays(daysAgo(d.dataUltimaMudanca))}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
