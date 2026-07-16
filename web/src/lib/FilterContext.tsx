import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchDashboard } from '@/api/client'
import type { DashboardResponse, Creative, Patient } from '@/api/types'
import { resolvePreset, type PresetKey } from '@/lib/dateRanges'

export interface SecondaryFilters {
  campanha: string | null
  conjunto: string | null
  criativo: string | null
  closer: string | null
  sdr: string | null
  procedimento: string | null
  origem: string | null
}

const EMPTY_FILTERS: SecondaryFilters = {
  campanha: null, conjunto: null, criativo: null, closer: null, sdr: null, procedimento: null, origem: null,
}

interface FilterContextValue {
  since: string
  until: string
  setRange: (since: string, until: string) => void
  applyPreset: (key: PresetKey) => void
  filters: SecondaryFilters
  setFilter: (key: keyof SecondaryFilters, value: string | null) => void
  clearFilters: () => void
  activeFilterCount: number
  data: DashboardResponse | null
  loading: boolean
  error: string | null
  reload: () => void
  filteredCreatives: Creative[]
  filteredPatients: Patient[]
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const initial = resolvePreset('mesAtual')
  const [since, setSince] = useState(initial.since)
  const [until, setUntil] = useState(initial.until)
  const [filters, setFilters] = useState<SecondaryFilters>(EMPTY_FILTERS)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchDashboard(since, until)
      .then(res => {
        if (!cancelled) {
          console.log('Dashboard data loaded:', res)
          setData(res)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Dashboard fetch error:', err)
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [since, until, reloadTick])

  const setRange = useCallback((s: string, u: string) => { setSince(s); setUntil(u) }, [])
  const applyPreset = useCallback((key: PresetKey) => {
    const r = resolvePreset(key)
    setSince(r.since); setUntil(r.until)
  }, [])
  const setFilter = useCallback((key: keyof SecondaryFilters, value: string | null) => {
    setFilters(f => ({ ...f, [key]: value }))
  }, [])
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])
  const reload = useCallback(() => setReloadTick(t => t + 1), [])

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const filteredCreatives = useMemo(() => {
    if (!data) return []
    return data.creatives.filter(c =>
      (!filters.campanha || c.campanha === filters.campanha) &&
      (!filters.conjunto || c.conjunto === filters.conjunto) &&
      (!filters.criativo || c.anuncio === filters.criativo)
    )
  }, [data, filters])

  const filteredPatients = useMemo(() => {
    if (!data) return []
    return data.patients.filter(p =>
      (!filters.campanha || p.campanha === filters.campanha) &&
      (!filters.conjunto || p.conjunto === filters.conjunto) &&
      (!filters.criativo || p.criativo === filters.criativo) &&
      (!filters.closer || p.closer === filters.closer) &&
      (!filters.sdr || p.sdr === filters.sdr) &&
      (!filters.procedimento || p.procedimento.includes(filters.procedimento))
    )
  }, [data, filters])

  const value: FilterContextValue = {
    since, until, setRange, applyPreset,
    filters, setFilter, clearFilters, activeFilterCount,
    data, loading, error, reload,
    filteredCreatives, filteredPatients,
  }

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters precisa estar dentro de FilterProvider')
  return ctx
}
