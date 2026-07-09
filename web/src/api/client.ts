import type { DashboardResponse, TintimAuditResponse } from './types'

export async function fetchDashboard(since: string, until: string): Promise<DashboardResponse> {
  const res = await fetch(`/api/dashboard?since=${since}&until=${until}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Erro ao carregar dados')
  return json as DashboardResponse
}

export async function fetchTintimAudit(): Promise<TintimAuditResponse> {
  const res = await fetch('/api/tintim-audit')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Erro ao consultar o Tintim')
  return json as TintimAuditResponse
}

export interface ApplyTintimSuggestionPayload {
  dealId: number
  campanha?: string | null
  conjunto?: string | null
  palavraChave?: string | null
  plataforma?: string | null
  origem?: string | null
}

export async function applyTintimSuggestion(payload: ApplyTintimSuggestionPayload): Promise<void> {
  const res = await fetch('/api/tintim-audit/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Erro ao atualizar o Pipedrive')
}
