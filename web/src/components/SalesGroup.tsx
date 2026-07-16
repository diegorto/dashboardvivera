import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, MessageCircle } from 'lucide-react'
import { formatBRL, whatsappUrl } from '@/lib/utils'

export interface SalesGroupItem {
  id: number
  nome: string
  telefone: string
  valor: number
  origem: string
  pipedriveUrl: string
}

export function SalesGroup({ label, total, items }: { label: string; total: number; items: SalesGroupItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-left hover:opacity-80" disabled={items.length === 0}>
        {items.length > 0 && (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        <span>{label}: <span className="font-semibold text-foreground">{formatBRL(total)}</span></span>
      </button>

      {open && items.length > 0 && (
        <div className="ml-1 mt-0.5 flex flex-col gap-2 border-l border-border pl-3">
          {items.map(item => {
            const wa = whatsappUrl(item.telefone)
            return (
              <div key={item.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <a
                    href={item.pipedriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                  >
                    {item.nome} <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-[11px] font-semibold text-foreground">{formatBRL(item.valor)}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-good hover:underline">
                      <MessageCircle className="h-3 w-3" /> {item.telefone}
                    </a>
                  ) : (
                    'sem telefone'
                  )}
                  {' · '}{item.origem}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
