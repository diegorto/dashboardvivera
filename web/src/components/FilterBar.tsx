import { useMemo, useState } from 'react'
import { Filter, Moon, Sun, Presentation, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useFilters, type SecondaryFilters } from '@/lib/FilterContext'
import { PRESET_LABELS, type PresetKey } from '@/lib/dateRanges'
import { useTheme } from '@/lib/useTheme'
import { cn } from '@/lib/utils'

const PRESETS: PresetKey[] = ['hoje', 'ontem', 'semanaAtual', 'semanaAnterior', 'mesAtual', 'mesAnterior', '7dias', '30dias', '90dias', 'trimestre']

export function FilterBar() {
  const { since, until, setRange, applyPreset, filters, setFilter, clearFilters, activeFilterCount, data, loading, reload } = useFilters()
  const { dark, toggle } = useTheme()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const options = useMemo(() => {
    if (!data) return { campanha: [], conjunto: [], criativo: [], closer: [], sdr: [], procedimento: [] }
    const uniq = (arr: (string | null | undefined)[]) => Array.from(new Set(arr.filter(Boolean))) as string[]
    return {
      campanha: uniq(data.creatives.map(c => c.campanha)),
      conjunto: uniq(data.creatives.map(c => c.conjunto)),
      criativo: uniq(data.creatives.map(c => c.anuncio)),
      closer: uniq(data.patients.map(p => p.closer || '')),
      sdr: uniq(data.patients.map(p => p.sdr || '')),
      procedimento: uniq(data.patients.map(p => p.procedimento || '')),
    }
  }, [data])

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={since}
            onChange={e => setRange(e.target.value, until)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs tabular-nums"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={until}
            onChange={e => setRange(since, e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs tabular-nums"
          />
        </div>

        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(o => !o)}>
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">{activeFilterCount}</span>
            )}
          </Button>
          {filtersOpen && (
            <FiltersPopover options={options} filters={filters} setFilter={setFilter} clearFilters={clearFilters} onClose={() => setFiltersOpen(false)} />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            {loading ? 'Carregando…' : 'Atualizar'}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link to="/reuniao">
              <Presentation className="h-3.5 w-3.5" />
              Modo Reunião
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function FiltersPopover({
  options, filters, setFilter, clearFilters, onClose,
}: {
  options: Record<string, string[]>
  filters: SecondaryFilters
  setFilter: (key: keyof SecondaryFilters, value: string | null) => void
  clearFilters: () => void
  onClose: () => void
}) {
  const fields: { key: keyof SecondaryFilters; label: string }[] = [
    { key: 'campanha', label: 'Campanha' },
    { key: 'conjunto', label: 'Conjunto' },
    { key: 'criativo', label: 'Criativo' },
    { key: 'closer', label: 'Closer' },
    { key: 'sdr', label: 'SDR' },
    { key: 'procedimento', label: 'Procedimento' },
  ]

  return (
    <div className="absolute left-0 top-9 z-40 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtros</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex flex-col gap-2">
        {fields.map(f => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">{f.label}</label>
            <select
              value={filters[f.key] ?? ''}
              onChange={e => setFilter(f.key, e.target.value || null)}
              className={cn('h-8 rounded-md border border-border bg-background px-2 text-xs', !options[f.key]?.length && 'opacity-50')}
            >
              <option value="">Todos</option>
              {(options[f.key] || []).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>
      <button onClick={clearFilters} className="mt-3 text-xs font-medium text-accent hover:underline">Limpar filtros</button>
    </div>
  )
}
