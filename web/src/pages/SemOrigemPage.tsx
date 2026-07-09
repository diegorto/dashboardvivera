import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SortHeader } from '@/components/SortHeader'
import { useSort } from '@/lib/useSort'
import { formatDate } from '@/lib/utils'
import type { LeadSemOrigem } from '@/api/types'

const STATUS_LABEL: Record<string, { label: string; variant: 'good' | 'warn' | 'critical' }> = {
  open: { label: 'Em aberto', variant: 'warn' },
  won: { label: 'Ganho', variant: 'good' },
  lost: { label: 'Perdido', variant: 'critical' },
}

export function SemOrigemPage() {
  const { data } = useFilters()
  const [search, setSearch] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [etapaFilter, setEtapaFilter] = useState('')

  const leads = data?.leadsSemOrigem ?? []

  const responsaveis = useMemo(() => Array.from(new Set(leads.map(l => l.responsavel))).sort(), [leads])
  const etapas = useMemo(() => Array.from(new Set(leads.map(l => l.etapa))).sort(), [leads])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter(l =>
      (!q || l.nome.toLowerCase().includes(q)) &&
      (!responsavelFilter || l.responsavel === responsavelFilter) &&
      (!etapaFilter || l.etapa === etapaFilter)
    )
  }, [leads, search, responsavelFilter, etapaFilter])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'dataEntrada')

  if (!data) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Leads sem Origem</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} de {leads.length} leads</span>
      </div>

      <Card className="border-warn/30 bg-warn-soft/40">
        <CardContent className="flex items-center gap-3 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
          <p className="text-sm text-warn">
            Esses leads não têm a Palavra-chave (criativo) preenchida no Pipedrive — sem isso não dá pra saber qual anúncio do Meta gerou o lead. Eles não aparecem nas páginas de Campanhas nem no Funil por criativo.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar pelo nome do lead…"
          className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
        />
        <select
          value={responsavelFilter}
          onChange={e => setResponsavelFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={etapaFilter}
          onChange={e => setEtapaFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Todas as etapas</option>
          {etapas.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="Nome do lead" active={sortKey === 'nome'} dir={sortKey === 'nome' ? sortDir : null} onClick={() => toggle('nome')} />
            <SortHeader label="Etapa do funil" active={sortKey === 'etapa'} dir={sortKey === 'etapa' ? sortDir : null} onClick={() => toggle('etapa')} />
            <SortHeader label="Responsável" active={sortKey === 'responsavel'} dir={sortKey === 'responsavel' ? sortDir : null} onClick={() => toggle('responsavel')} />
            <SortHeader label="Status" active={sortKey === 'status'} dir={sortKey === 'status' ? sortDir : null} onClick={() => toggle('status')} />
            <SortHeader label="Data de entrada" active={sortKey === 'dataEntrada'} dir={sortKey === 'dataEntrada' ? sortDir : null} onClick={() => toggle('dataEntrada')} align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum lead sem origem no período/filtro — ótimo sinal.</TableCell></TableRow>
          )}
          {sorted.map((l: LeadSemOrigem) => {
            const s = STATUS_LABEL[l.status] || { label: l.status, variant: 'warn' as const }
            return (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell>{l.etapa}</TableCell>
                <TableCell>{l.responsavel}</TableCell>
                <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                <TableCell className="text-right">{formatDate(l.dataEntrada)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
