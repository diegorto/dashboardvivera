import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { SortHeader } from '@/components/SortHeader'
import { StatusPill } from '@/components/StatusPill'
import { Sparkline } from '@/components/Sparkline'
import { useSort } from '@/lib/useSort'
import { formatBRL, formatBRLPrecise, formatNumber } from '@/lib/utils'
import type { Creative } from '@/api/types'

export function CreativesTable({ rows, searchable = false }: { rows: Creative[]; searchable?: boolean }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r => r.campanha.toLowerCase().includes(q) || r.conjunto.toLowerCase().includes(q) || r.anuncio.toLowerCase().includes(q))
  }, [rows, search])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'receita')

  return (
    <div className="flex flex-col gap-2">
      {searchable && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar campanha, conjunto ou criativo…"
          className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="Ranking" active={false} dir={null} onClick={() => {}} />
            <SortHeader label="Criativo" active={sortKey === 'anuncio'} dir={sortKey === 'anuncio' ? sortDir : null} onClick={() => toggle('anuncio')} />
            <SortHeader label="Mensagens (Meta)" active={sortKey === 'mensagensMeta'} dir={sortKey === 'mensagensMeta' ? sortDir : null} onClick={() => toggle('mensagensMeta')} align="right" />
            <SortHeader label="Leads (Pipedrive)" active={sortKey === 'leads'} dir={sortKey === 'leads' ? sortDir : null} onClick={() => toggle('leads')} align="right" />
            <SortHeader label="Receita" active={sortKey === 'receita'} dir={sortKey === 'receita' ? sortDir : null} onClick={() => toggle('receita')} align="right" />
            <SortHeader label="Compras" active={sortKey === 'compras'} dir={sortKey === 'compras' ? sortDir : null} onClick={() => toggle('compras')} align="right" />
            <SortHeader label="ROAS" active={sortKey === 'roas'} dir={sortKey === 'roas' ? sortDir : null} onClick={() => toggle('roas')} align="right" />
            <SortHeader label="Investimento" active={sortKey === 'investimento'} dir={sortKey === 'investimento' ? sortDir : null} onClick={() => toggle('investimento')} align="right" />
            <SortHeader label="Receita/Lead" active={sortKey === 'receitaPorLead'} dir={sortKey === 'receitaPorLead' ? sortDir : null} onClick={() => toggle('receitaPorLead')} align="right" />
            <SortHeader label="Receita/Agend." active={sortKey === 'receitaPorAgendamento'} dir={sortKey === 'receitaPorAgendamento' ? sortDir : null} onClick={() => toggle('receitaPorAgendamento')} align="right" />
            <SortHeader label="Tendência" active={false} dir={null} onClick={() => {}} />
            <SortHeader label="Status" active={sortKey === 'status'} dir={sortKey === 'status' ? sortDir : null} onClick={() => toggle('status')} />
            <SortHeader label="Ação" active={false} dir={null} onClick={() => {}} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={13} className="py-8 text-center text-muted-foreground">Nenhum criativo encontrado.</TableCell></TableRow>
          )}
          {sorted.map((c, i) => (
            <TableRow key={`${c.campanha}|${c.conjunto}|${c.anuncio}`} className="group relative">
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="max-w-[220px] truncate font-medium">
                <CreativeHoverName creative={c} />
              </TableCell>
              <TableCell className="text-right">{formatNumber(c.mensagensMeta)}</TableCell>
              <TableCell className={`text-right ${c.mensagensMeta > 0 && c.leads < c.mensagensMeta * 0.5 ? 'font-semibold text-warn' : ''}`} title={c.mensagensMeta > 0 && c.leads < c.mensagensMeta * 0.5 ? 'Meta reporta bem mais mensagens do que o Pipedrive captura - pode indicar leads que não estão virando negócio no CRM.' : undefined}>
                {formatNumber(c.leads)}
              </TableCell>
              <TableCell className="text-right font-semibold">{formatBRL(c.receita)}</TableCell>
              <TableCell className="text-right">{formatNumber(c.compras)}</TableCell>
              <TableCell className="text-right">{c.roas.toFixed(2)}x</TableCell>
              <TableCell className="text-right">{formatBRL(c.investimento)}</TableCell>
              <TableCell className="text-right">{formatBRLPrecise(c.receitaPorLead)}</TableCell>
              <TableCell className="text-right">{formatBRLPrecise(c.receitaPorAgendamento)}</TableCell>
              <TableCell><Sparkline data={c.trend} direction={c.trendDirection} /></TableCell>
              <TableCell><StatusPill status={c.status} /></TableCell>
              <TableCell>
                {c.adUrl ? (
                  <a href={c.adUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                    Ver anúncio <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreativeHoverName({ creative }: { creative: Creative }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span>{creative.anuncio}</span>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-72 rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
          {creative.thumbnailUrl ? (
            <img src={creative.thumbnailUrl} alt="" className="mb-2 h-32 w-full rounded-md object-cover" />
          ) : (
            <div className="mb-2 flex h-20 w-full items-center justify-center rounded-md bg-muted text-muted-foreground">Sem thumbnail</div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <dt className="text-muted-foreground">Campanha</dt><dd className="truncate">{creative.campanha}</dd>
            <dt className="text-muted-foreground">Conjunto</dt><dd className="truncate">{creative.conjunto}</dd>
            <dt className="text-muted-foreground">Anúncio</dt><dd className="truncate">{creative.anuncio}</dd>
            {creative.adId && (<><dt className="text-muted-foreground">ID</dt><dd className="truncate">{creative.adId}</dd></>)}
            {creative.adStatus && (<><dt className="text-muted-foreground">Status</dt><dd>{creative.adStatus}</dd></>)}
            <dt className="text-muted-foreground">Investimento</dt><dd>{formatBRL(creative.investimento)}</dd>
            <dt className="text-muted-foreground">Receita</dt><dd>{formatBRL(creative.receita)}</dd>
            <dt className="text-muted-foreground">Compras</dt><dd>{creative.compras}</dd>
          </dl>
        </div>
      )}
    </span>
  )
}
