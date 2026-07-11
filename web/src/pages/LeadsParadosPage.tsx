import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, AlertTriangle } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { SortHeader } from '@/components/SortHeader'
import { useSort } from '@/lib/useSort'
import { formatDate, formatNumber } from '@/lib/utils'
import { exportToXlsx } from '@/lib/exportXlsx'
import type { PipelineDealRef } from '@/api/types'

const STUCK_LABELS = ['22-30 dias', '30+ dias']

export function LeadsParadosPage() {
  const { data } = useFilters()
  const [search, setSearch] = useState('')

  const leads = useMemo(() => {
    if (!data) return []
    return data.pipeline.buckets
      .filter(b => STUCK_LABELS.includes(b.label))
      .flatMap(b => b.deals)
  }, [data])

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter(l => l.title.toLowerCase().includes(q) || l.responsavel.toLowerCase().includes(q))
  }, [leads, search])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'days')

  if (!data) return null

  function handleExport() {
    exportToXlsx(
      `leads-parados-mais-de-21-dias-${data!.range.since}-a-${data!.range.until}.xlsx`,
      'Leads parados',
      sorted.map((l: PipelineDealRef) => ({
        'Nome do lead': l.title,
        'Dias parado': l.days,
        'Etapa do funil': l.etapa,
        'Campanha': l.campanha,
        'Criativo': l.anuncio,
        'Responsável': l.responsavel,
        'Data de entrada': l.dataEntrada,
      }))
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Link to="/insights" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar pra Insights
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Leads parados há mais de 21 dias</h1>
        <Button size="sm" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Exportar XLS
        </Button>
      </div>

      <Card className="border-critical/30 bg-critical-soft/40">
        <CardContent className="flex items-center gap-3 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-critical" />
          <p className="text-sm text-critical">{formatNumber(leads.length)} leads em aberto sem contato/avanço há mais de 21 dias — cada linha aqui é um lead que precisa de ação do responsável.</p>
        </CardContent>
      </Card>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar pelo nome do lead ou responsável…"
        className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="Nome do lead" active={sortKey === 'title'} dir={sortKey === 'title' ? sortDir : null} onClick={() => toggle('title')} />
            <SortHeader label="Dias parado" active={sortKey === 'days'} dir={sortKey === 'days' ? sortDir : null} onClick={() => toggle('days')} align="right" />
            <SortHeader label="Etapa do funil" active={sortKey === 'etapa'} dir={sortKey === 'etapa' ? sortDir : null} onClick={() => toggle('etapa')} />
            <SortHeader label="Campanha" active={sortKey === 'campanha'} dir={sortKey === 'campanha' ? sortDir : null} onClick={() => toggle('campanha')} />
            <SortHeader label="Criativo" active={sortKey === 'anuncio'} dir={sortKey === 'anuncio' ? sortDir : null} onClick={() => toggle('anuncio')} />
            <SortHeader label="Responsável" active={sortKey === 'responsavel'} dir={sortKey === 'responsavel' ? sortDir : null} onClick={() => toggle('responsavel')} />
            <SortHeader label="Data de entrada" active={sortKey === 'dataEntrada'} dir={sortKey === 'dataEntrada' ? sortDir : null} onClick={() => toggle('dataEntrada')} align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum lead parado há mais de 21 dias — ótimo sinal.</TableCell></TableRow>
          )}
          {sorted.map((l: PipelineDealRef) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.title}</TableCell>
              <TableCell className="text-right font-semibold text-critical">{l.days}d</TableCell>
              <TableCell>{l.etapa}</TableCell>
              <TableCell className="max-w-[180px] truncate">{l.campanha}</TableCell>
              <TableCell className="max-w-[180px] truncate">{l.anuncio}</TableCell>
              <TableCell>{l.responsavel}</TableCell>
              <TableCell className="text-right">{formatDate(l.dataEntrada)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
