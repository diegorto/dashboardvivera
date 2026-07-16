import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import type { Creative } from '@/api/types'

export function LostCreativesTable({ rows }: { rows: Creative[] }) {
  const top10 = [...rows].filter(c => c.perdidos > 0).sort((a, b) => b.perdidos - a.perdidos).slice(0, 10)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Criativo</TableHead>
          <TableHead className="text-right">Perdidos</TableHead>
          <TableHead>Principais motivos de perda</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {top10.length === 0 && (
          <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum criativo com negócios perdidos no período.</TableCell></TableRow>
        )}
        {top10.map((c, i) => (
          <TableRow key={`${c.campanha}|${c.conjunto}|${c.anuncio}`}>
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="max-w-[220px] truncate font-medium">
              {c.anuncio}
              <div className="truncate text-xs font-normal text-muted-foreground">{c.campanha} / {c.conjunto}</div>
            </TableCell>
            <TableCell className="text-right font-semibold text-critical">{formatNumber(c.perdidos)}</TableCell>
            <TableCell>
              {c.objecoes.length === 0 && <span className="text-xs text-muted-foreground">Sem tag de motivo registrada</span>}
              <div className="flex flex-wrap gap-1">
                {c.objecoes.map(o => (
                  <Badge key={o.tag} variant="critical">{o.tag} ({o.count})</Badge>
                ))}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
