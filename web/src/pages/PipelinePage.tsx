import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, MessageCircle } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL, formatNumber, formatDate, whatsappUrl, cn } from '@/lib/utils'
import type { PipelineBucket, PipelineDealRef } from '@/api/types'

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
              {openBucket.deals.map(d => <PipelineDealRow key={d.id} deal={d} />)}
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

function PipelineDealRow({ deal }: { deal: PipelineDealRef }) {
  const [open, setOpen] = useState(false)
  const wa = whatsappUrl(deal.telefone || '')
  const tags = deal.tags || []

  return (
    <li className="py-2 text-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 text-left hover:bg-slate-50 rounded px-1 -mx-1 transition"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          <span className="truncate font-medium">{deal.title}</span>
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">{deal.etapa}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{deal.days} dias · {deal.anuncio}</span>
      </button>

      {tags.length > 0 && (
        <div className="ml-6 mt-1 flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t} className="rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 border border-yellow-200">{t}</span>
          ))}
        </div>
      )}

      {open && (
        <div className="ml-6 mt-2 mb-1 rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2 text-xs">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Última interação do lead: </span>
              <span className="font-semibold">{deal.ultimaInteracao ? formatDate(deal.ultimaInteracao) : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Última mudança de etapa: </span>
              <span className="font-semibold">{deal.ultimaMudancaEtapa ? formatDate(deal.ultimaMudancaEtapa) : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Entrada no funil: </span>
              <span className="font-semibold">{formatDate(deal.dataEntrada)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Responsável: </span>
              <span className="font-semibold">{deal.responsavel}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700 transition"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 px-3 py-1.5 font-medium text-slate-500">Sem telefone</span>
            )}
            <a
              href={deal.pipedriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver no Pipedrive
            </a>
          </div>
        </div>
      )}
    </li>
  )
}
