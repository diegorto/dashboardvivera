import { useMemo, useState } from 'react'
import { Phone, Link as LinkIcon } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SortHeader } from '@/components/SortHeader'
import { useSort } from '@/lib/useSort'
import { formatDate } from '@/lib/utils'
import type { LeadOutrasFontes } from '@/api/types'

export function OutrasFontesPage() {
  const { data } = useFilters()
  const [search, setSearch] = useState('')
  const [proprietarioFilter, setProprietarioFilter] = useState('')

  const leads = data?.leadsOutrasFontes ?? []

  const proprietarios = useMemo(
    () => Array.from(new Set(leads.map(l => l.proprietario))).sort(),
    [leads]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter(l =>
      (!q || l.nome.toLowerCase().includes(q) || l.telefone.includes(q)) &&
      (!proprietarioFilter || l.proprietario === proprietarioFilter)
    )
  }, [leads, search, proprietarioFilter])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'dataCriacao')

  if (!data) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Leads de Outras Fontes</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} de {leads.length} leads</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
        />
        <select
          value={proprietarioFilter}
          onChange={e => setProprietarioFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Todos os proprietários</option>
          {proprietarios.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <SortHeader
                label="Nome"
                active={sortKey === 'nome'}
                dir={sortKey === 'nome' ? sortDir : null}
                onClick={() => toggle('nome')}
                className="min-w-40"
              />
              <SortHeader
                label="Telefone"
                active={sortKey === 'telefone'}
                dir={sortKey === 'telefone' ? sortDir : null}
                onClick={() => toggle('telefone')}
                className="min-w-32"
              />
              <SortHeader
                label="Proprietário"
                active={sortKey === 'proprietario'}
                dir={sortKey === 'proprietario' ? sortDir : null}
                onClick={() => toggle('proprietario')}
                className="min-w-32"
              />
              <SortHeader
                label="Origem"
                active={sortKey === 'origem'}
                dir={sortKey === 'origem' ? sortDir : null}
                onClick={() => toggle('origem')}
                className="min-w-24"
              />
              <SortHeader
                label="Tags"
                active={sortKey === 'tags'}
                dir={sortKey === 'tags' ? sortDir : null}
                onClick={() => toggle('tags')}
                className="min-w-32"
              />
              <SortHeader
                label="Data"
                active={sortKey === 'dataCriacao'}
                dir={sortKey === 'dataCriacao' ? sortDir : null}
                onClick={() => toggle('dataCriacao')}
                align="right"
                className="min-w-24"
              />
              <TableCell className="w-16 text-center">Links</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum lead de outras fontes no período.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((lead: LeadOutrasFontes) => (
              <TableRow key={lead.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <a
                    href={lead.linkPipedrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {lead.nome}
                  </a>
                </TableCell>
                <TableCell>
                  {lead.telefone ? (
                    <a
                      href={lead.linkWhatsapp || `tel:${lead.telefone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {lead.telefone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{lead.proprietario}</TableCell>
                <TableCell>
                  <Badge variant="outline">{lead.origem}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.length > 0 ? (
                      lead.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs">{formatDate(lead.dataCriacao)}</TableCell>
                <TableCell className="text-center">
                  <a
                    href={lead.linkPipedrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-blue-600"
                    title="Abrir no Pipedrive"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
