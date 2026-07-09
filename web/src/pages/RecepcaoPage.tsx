import { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { SortHeader } from '@/components/SortHeader'
import { Card, CardContent } from '@/components/ui/card'
import { KpiCard } from '@/components/KpiCard'
import { useSort } from '@/lib/useSort'
import { formatBRL, formatNumber, formatDate } from '@/lib/utils'
import type { FechamentoRecepcao } from '@/api/types'

export function RecepcaoPage() {
  const { data } = useFilters()
  const [search, setSearch] = useState('')

  const fechamentos = data?.recepcao.fechamentos ?? []

  const filtered = useMemo(() => {
    if (!search.trim()) return fechamentos
    const q = search.toLowerCase()
    return fechamentos.filter(f => f.nome.toLowerCase().includes(q) || f.procedimento.toLowerCase().includes(q))
  }, [fechamentos, search])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'dataFechamento')

  if (!data) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-bold">Fechamentos da Recepção</h1>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} de {fechamentos.length} fechamentos</span>
      </div>

      <Card>
        <CardContent className="p-3.5 text-xs text-muted-foreground">
          Fechamentos feitos direto pela clínica (indicação, retorno, já é paciente etc.) — sem atribuição de campanha do Meta Ads. Fica separado do restante do painel de propósito, pra não diluir o resultado específico do marketing.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Receita Recepção" metric={data.recepcao.kpis.receita} format={formatBRL} />
        <KpiCard label="Fechamentos" metric={data.recepcao.kpis.compras} format={formatNumber} />
        <KpiCard label="Ticket Médio" metric={data.recepcao.kpis.ticketMedio} format={formatBRL} />
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar paciente ou procedimento…"
        className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="Nome" active={sortKey === 'nome'} dir={sortKey === 'nome' ? sortDir : null} onClick={() => toggle('nome')} />
            <SortHeader label="Procedimento" active={sortKey === 'procedimento'} dir={sortKey === 'procedimento' ? sortDir : null} onClick={() => toggle('procedimento')} />
            <SortHeader label="Closer" active={sortKey === 'closer'} dir={sortKey === 'closer' ? sortDir : null} onClick={() => toggle('closer')} />
            <SortHeader label="Responsável" active={sortKey === 'responsavel'} dir={sortKey === 'responsavel' ? sortDir : null} onClick={() => toggle('responsavel')} />
            <SortHeader label="Valor" active={sortKey === 'valor'} dir={sortKey === 'valor' ? sortDir : null} onClick={() => toggle('valor')} align="right" />
            <SortHeader label="Data de fechamento" active={sortKey === 'dataFechamento'} dir={sortKey === 'dataFechamento' ? sortDir : null} onClick={() => toggle('dataFechamento')} align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum fechamento da recepção no período/filtro.</TableCell></TableRow>
          )}
          {sorted.map((f: FechamentoRecepcao) => (
            <TableRow key={f.id}>
              <TableCell className="font-medium">{f.nome}</TableCell>
              <TableCell className="max-w-[200px] truncate">{f.procedimento}</TableCell>
              <TableCell>{f.closer ?? <span className="text-critical">sem etiqueta</span>}</TableCell>
              <TableCell>{f.responsavel || '—'}</TableCell>
              <TableCell className="text-right font-semibold">{formatBRL(f.valor)}</TableCell>
              <TableCell className="text-right">{f.dataFechamento ? formatDate(f.dataFechamento) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
