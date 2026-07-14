import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search as SearchIcon } from 'lucide-react'
import { fetchTintimAudit, applyTintimSuggestion } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortHeader } from '@/components/SortHeader'
import { useSort } from '@/lib/useSort'
import { formatDate } from '@/lib/utils'
import type { TintimAuditItem } from '@/api/types'

type StatusFilter = 'all' | 'recuperavel' | 'sem-rastreio' | 'sem-telefone'

export function TintimAuditoriaPage() {
  const [items, setItems] = useState<TintimAuditItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set())
  const [applyErrors, setApplyErrors] = useState<Record<number, string>>({})

  function load() {
    setLoading(true)
    setError(null)
    fetchTintimAudit()
      .then(res => setItems(res.items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const classify = (item: TintimAuditItem): 'recuperavel' | 'sem-rastreio' | 'sem-telefone' => {
    if (item.tintim.noPhone) return 'sem-telefone'
    if (item.tintim.found && item.tintim.hasAdData) return 'recuperavel'
    return 'sem-rastreio'
  }

  const summary = useMemo(() => {
    const list = items ?? []
    return {
      total: list.length,
      recuperavel: list.filter(i => classify(i) === 'recuperavel').length,
      semRastreio: list.filter(i => classify(i) === 'sem-rastreio').length,
      semTelefone: list.filter(i => classify(i) === 'sem-telefone').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const filtered = useMemo(() => {
    const list = items ?? []
    const q = search.toLowerCase()
    return list.filter(i =>
      (!q || i.nome.toLowerCase().includes(q) || i.responsavel.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || classify(i) === statusFilter)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, statusFilter])

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'dataEntrada')

  async function handleApply(item: TintimAuditItem) {
    setApplyingId(item.dealId)
    try {
      await applyTintimSuggestion({
        dealId: item.dealId,
        campanha: item.tintim.campanha,
        conjunto: item.tintim.conjunto,
        palavraChave: item.tintim.palavraChave,
        plataforma: item.tintim.plataforma,
        origem: item.tintim.origemSugerida,
      })
      setAppliedIds(prev => new Set(prev).add(item.dealId))
    } catch (err) {
      setApplyErrors(prev => ({ ...prev, [item.dealId]: err instanceof Error ? err.message : 'Erro ao atualizar' }))
    } finally {
      setApplyingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Auditoria Tintim</h1>
          <p className="text-xs text-muted-foreground">Cruza os leads sem Palavra-chave no Pipedrive com o rastreamento do Tintim (por telefone) pra tentar recuperar a origem.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Consultar de novo
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Consultando o Tintim pra cada lead sem origem por telefone… pode levar alguns minutos se forem muitos leads.</p>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-critical/30 bg-critical-soft/40">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-critical" />
            <p className="text-sm text-critical">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && items && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Sem origem" value={summary.total} variant="neutral" />
            <SummaryTile label="Recuperáveis no Tintim" value={summary.recuperavel} variant="good" />
            <SummaryTile label="Tintim também sem rastreio" value={summary.semRastreio} variant="critical" />
            <SummaryTile label="Sem telefone cadastrado" value={summary.semTelefone} variant="warn" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar pelo nome do lead ou responsável…"
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="all">Todos os status</option>
              <option value="recuperavel">Recuperáveis no Tintim</option>
              <option value="sem-rastreio">Tintim também sem rastreio</option>
              <option value="sem-telefone">Sem telefone cadastrado</option>
            </select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Nome do lead" active={sortKey === 'nome'} dir={sortKey === 'nome' ? sortDir : null} onClick={() => toggle('nome')} />
                <SortHeader label="Etapa" active={sortKey === 'etapa'} dir={sortKey === 'etapa' ? sortDir : null} onClick={() => toggle('etapa')} />
                <SortHeader label="Responsável" active={sortKey === 'responsavel'} dir={sortKey === 'responsavel' ? sortDir : null} onClick={() => toggle('responsavel')} />
                <SortHeader label="Data de entrada" active={sortKey === 'dataEntrada'} dir={sortKey === 'dataEntrada' ? sortDir : null} onClick={() => toggle('dataEntrada')} />
                <TableHead>Tintim</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum lead nesse filtro.</TableCell></TableRow>
              )}
              {sorted.map(item => (
                <AuditRow
                  key={item.dealId}
                  item={item}
                  applied={appliedIds.has(item.dealId)}
                  applying={applyingId === item.dealId}
                  confirming={confirmingId === item.dealId}
                  errorMsg={applyErrors[item.dealId]}
                  onAskConfirm={() => setConfirmingId(item.dealId)}
                  onCancelConfirm={() => setConfirmingId(null)}
                  onConfirm={() => handleApply(item)}
                />
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}

function SummaryTile({ label, value, variant }: { label: string; value: number; variant: 'neutral' | 'good' | 'critical' | 'warn' }) {
  const colors: Record<string, string> = {
    neutral: 'border-border bg-card text-foreground',
    good: 'border-good/30 bg-good-soft/40 text-good',
    critical: 'border-critical/30 bg-critical-soft/40 text-critical',
    warn: 'border-warn/30 bg-warn-soft/40 text-warn',
  }
  return (
    <div className={`rounded-lg border p-3 ${colors[variant]}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  )
}

function AuditRow({
  item, applied, applying, confirming, errorMsg, onAskConfirm, onCancelConfirm, onConfirm,
}: {
  item: TintimAuditItem
  applied: boolean
  applying: boolean
  confirming: boolean
  errorMsg?: string
  onAskConfirm: () => void
  onCancelConfirm: () => void
  onConfirm: () => void
}) {
  const t = item.tintim
  const recuperavel = !t.noPhone && t.found && t.hasAdData

  return (
    <TableRow>
      <TableCell className="font-medium">{item.nome}</TableCell>
      <TableCell>{item.etapa}</TableCell>
      <TableCell>{item.responsavel}</TableCell>
      <TableCell>{formatDate(item.dataEntrada)}</TableCell>
      <TableCell>
        {t.noPhone && <Badge variant="warn">Sem telefone</Badge>}
        {!t.noPhone && !recuperavel && <Badge variant="critical">Tintim também sem rastreio</Badge>}
        {recuperavel && (
          <div className="flex flex-col gap-0.5">
            <Badge variant="good">Origem encontrada</Badge>
            <div className="mt-1 max-w-[280px] whitespace-normal break-words text-[11px] leading-snug text-muted-foreground">
              <div><span className="font-medium text-foreground">Campanha:</span> {t.campanha}</div>
              <div><span className="font-medium text-foreground">Conjunto:</span> {t.conjunto}</div>
              <div><span className="font-medium text-foreground">Anúncio:</span> {t.palavraChave}</div>
              <div><span className="font-medium text-foreground">Plataforma:</span> {t.plataforma}</div>
              {t.origemSugerida && <div><span className="font-medium text-foreground">Origem sugerida:</span> {t.origemSugerida} <span className="italic">(inferido do nome, confira)</span></div>}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell>
        {applied && <span className="inline-flex items-center gap-1 text-xs font-semibold text-good"><CheckCircle2 className="h-3.5 w-3.5" /> Atualizado</span>}
        {!applied && recuperavel && !confirming && (
          <Button size="sm" variant="outline" onClick={onAskConfirm}>Atualizar no Pipedrive</Button>
        )}
        {!applied && recuperavel && confirming && (
          <div className="flex max-w-[200px] flex-col gap-1 whitespace-normal">
            <span className="text-[11px] text-muted-foreground">Confirma a atualização desses campos no Pipedrive?</span>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={onConfirm} disabled={applying}>
                {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sim, atualizar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelConfirm} disabled={applying}>Cancelar</Button>
            </div>
          </div>
        )}
        {errorMsg && <div className="mt-1 text-[11px] text-critical">{errorMsg}</div>}
      </TableCell>
    </TableRow>
  )
}
