import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { FilterBar } from '@/components/FilterBar'
import { useFilters } from '@/lib/FilterContext'
import { AlertTriangle } from 'lucide-react'

export function Layout() {
  const { loading, error } = useFilters()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <FilterBar />
        <main className="flex-1 p-4 md:p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Erro ao carregar dados: {error}
            </div>
          )}
          {loading && !error ? <LoadingState /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}
