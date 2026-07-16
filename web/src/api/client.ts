import type { DashboardResponse, TintimAuditResponse, Funnel } from './types'

export async function fetchDashboard(since: string, until: string): Promise<DashboardResponse> {
  try {
    const res = await fetch(`/api/dashboard?since=${since}&until=${until}`)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Erro ao carregar dados')
    return json as DashboardResponse
  } catch (err) {
    console.error('fetchDashboard error:', err)
    throw err
  }
}

export interface FunilRealResponse {
  success: boolean
  range: { since: string; until: string }
  funnel: Funnel
  dealsAnalisados: number
  error?: string
}

export async function fetchFunilReal(since: string, until: string): Promise<FunilRealResponse> {
  const res = await fetch(`/api/funil-real?since=${since}&until=${until}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Erro ao calcular o funil real')
  return json as FunilRealResponse
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

export interface AdPreviewResponse {
  success: boolean
  format?: string
  html?: string
  error?: string
}

export async function fetchAdPreview(adId: string, format?: string): Promise<AdPreviewResponse> {
  const qs = format ? `?format=${encodeURIComponent(format)}` : ''
  const res = await fetch(`/api/ad-preview/${adId}${qs}`)
  return res.json() as Promise<AdPreviewResponse>
}
