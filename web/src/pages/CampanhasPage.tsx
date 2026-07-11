import { useFilters } from '@/lib/FilterContext'
import { CreativesTable } from '@/components/CreativesTable'

export function CampanhasPage() {
  const { filteredCreatives } = useFilters()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Campanhas</h1>
        <span className="text-xs text-muted-foreground">{filteredCreatives.length} linhas</span>
      </div>
      <CreativesTable rows={filteredCreatives} searchable />
    </div>
  )
}
