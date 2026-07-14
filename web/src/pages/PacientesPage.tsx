import { useMemo, useState } from 'react'
import { useFilters } from '@/lib/FilterContext'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { SortHeader } from '@/components/SortHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSort } from '@/lib/useSort'
import { formatBRL, formatDate } from '@/lib/utils'
import type { Patient } from '@/api/types'

export function PacientesPage() {
  const { filteredPatients } = useFilters()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return filteredPatients
    const q = search.toLowerCase()
    return filteredPatients.filter(p => p.nome.toLowerCase().includes(q) || p.criativo.toLowerCase().includes(q) || p.campanha.toLowerCase().includes(q))
  }, [filteredPatients, search])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'dataVenda')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Pacientes</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} pacientes</span>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar paciente, criativo ou campanha…"
        className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2.4fr_1fr]">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Nome" active={sortKey === 'nome'} dir={sortKey === 'nome' ? sortDir : null} onClick={() => toggle('nome')} />
              <SortHeader label="Criativo" active={sortKey === 'criativo'} dir={sortKey === 'criativo' ? sortDir : null} onClick={() => toggle('criativo')} />
              <SortHeader label="Closer" active={sortKey === 'closer'} dir={sortKey === 'closer' ? sortDir : null} onClick={() => toggle('closer')} />
              <SortHeader label="SDR" active={sortKey === 'sdr'} dir={sortKey === 'sdr' ? sortDir : null} onClick={() => toggle('sdr')} />
              <SortHeader label="Procedimento" active={sortKey === 'procedimento'} dir={sortKey === 'procedimento' ? sortDir : null} onClick={() => toggle('procedimento')} />
              <SortHeader label="Valor" active={sortKey === 'valor'} dir={sortKey === 'valor' ? sortDir : null} onClick={() => toggle('valor')} align="right" />
              <SortHeader label="Data venda" active={sortKey === 'dataVenda'} dir={sortKey === 'dataVenda' ? sortDir : null} onClick={() => toggle('dataVenda')} align="right" />
              <SortHeader label="Tempo até fechar" active={sortKey === 'tempoAteFechar'} dir={sortKey === 'tempoAteFechar' ? sortDir : null} onClick={() => toggle('tempoAteFechar')} align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum paciente no período/filtro.</TableCell></TableRow>
            )}
            {sorted.map(p => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="max-w-[160px] truncate">{p.criativo}</TableCell>
                <TableCell>{p.closer ?? <span className="text-critical">sem etiqueta</span>}</TableCell>
                <TableCell>{p.sdr || '—'}</TableCell>
                <TableCell className="max-w-[160px] truncate">{p.procedimento}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(p.valor)}</TableCell>
                <TableCell className="text-right">{p.dataVenda ? formatDate(p.dataVenda) : '—'}</TableCell>
                <TableCell className="text-right">{p.tempoAteFechar !== null ? `${p.tempoAteFechar}d` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Card className={selected ? '' : 'hidden xl:block'}>
          <CardHeader><CardTitle>Ficha do paciente</CardTitle></CardHeader>
          <CardContent>
            {!selected && <p className="text-xs text-muted-foreground">Clique numa linha da tabela pra ver o detalhe completo.</p>}
            {selected && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{selected.nome}</dd>
                <dt className="text-muted-foreground">Telefone</dt><dd>{selected.telefone || '—'}</dd>
                <dt className="text-muted-foreground">Campanha</dt><dd className="truncate">{selected.campanha}</dd>
                <dt className="text-muted-foreground">Conjunto</dt><dd className="truncate">{selected.conjunto}</dd>
                <dt className="text-muted-foreground">Criativo</dt><dd className="truncate">{selected.criativo}</dd>
                <dt className="text-muted-foreground">Closer</dt><dd>{selected.closer ?? <span className="text-critical">sem etiqueta</span>}</dd>
                <dt className="text-muted-foreground">SDR</dt><dd>{selected.sdr || '—'}</dd>
                <dt className="text-muted-foreground">Procedimento</dt><dd>{selected.procedimento}</dd>
                <dt className="text-muted-foreground">Valor</dt><dd className="font-semibold">{formatBRL(selected.valor)}</dd>
                <dt className="text-muted-foreground">Data do lead</dt><dd>{formatDate(selected.dataLead)}</dd>
                <dt className="text-muted-foreground">Data da venda</dt><dd>{selected.dataVenda ? formatDate(selected.dataVenda) : '—'}</dd>
                <dt className="text-muted-foreground">Tempo até fechar</dt><dd>{selected.tempoAteFechar !== null ? `${selected.tempoAteFechar} dias` : '—'}</dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
