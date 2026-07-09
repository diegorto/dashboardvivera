import type { DashboardResponse } from './types'

export async function fetchDashboard(since: string, until: string): Promise<DashboardResponse> {
  const res = await fetch(`/api/dashboard?since=${since}&until=${until}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Erro ao carregar dados')
  return json as DashboardResponse
}
