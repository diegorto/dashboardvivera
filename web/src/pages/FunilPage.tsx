import { useEffect, useState } from 'react'
import { ChevronRight, AlertTriangle, TrendingUp, Info, Loader2, X } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { fetchFunilReal } from '@/api/client'
import { formatNumber, formatPercent, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Insight, Funnel, FunnelTopCreative } from '@/api/types'

export function FunilPage() {
  const { since, until } = useFilters()
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [dealsAnalisados, setDealsAnalisados] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchFunilReal(since, until)
      .then(res => { if (!cancelled) { setFunnel(res.funnel); setDealsAnalisados(res.dealsAnalisados) } })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [since, until])

  const max = funnel?.stages[0]?.count || 1
  const selectedStage = funnel?.stages.find(s => s.key === selected)
  const allCreatives = (funnel && selected) ? funnel.topCreativesByStage[selected] || [] : []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhamento em tempo real da progressão de leads</p>
      </div>

      {loading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Calculando o funil real{dealsAnalisados > 0 ? ` (${dealsAnalisados} negócios analisados)` : ''}…
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && funnel && (
        <>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Evolução do Funil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {funnel.stages.map((stage, i) => {
                  const conversionRate = i === 0 ? 100 : ((stage.count / (funnel.stages[i - 1]?.count || 1)) * 100).toFixed(0)
                  const lossRate = stage.count > 0 ? ((stage.perdidos / stage.count) * 100).toFixed(0) : 0

                  return (
                    <div key={stage.key} className="flex items-end gap-1.5">
                      <button
                        onClick={() => setSelected(stage.key === selected ? null : stage.key)}
                        className={cn(
                          'flex flex-col items-center gap-3 rounded-xl p-4 transition-all duration-200 hover:shadow-md cursor-pointer',
                          'border border-slate-200 bg-white hover:bg-slate-50',
                          selected === stage.key && 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                        )}
                        style={{ minWidth: '160px' }}
                      >
                        <div className="text-center w-full">
                          <div className="text-2xl font-bold text-slate-900">{formatNumber(stage.count)}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            <div>{formatPercent(stage.pctFromStart, 0)} do total</div>
                            {i > 0 && <div className="text-blue-600 font-medium">{conversionRate}% conversão</div>}
                          </div>
                        </div>

                        <div className="w-full h-24 flex flex-col-reverse overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                          <div
                            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 transition-all"
                            style={{ height: `${Math.max(stage.count > 0 ? 8 : 0, ((stage.count - stage.perdidos) / max) * 100)}%` }}
                          />
                          {stage.perdidos > 0 && (
                            <div
                              className="w-full bg-gradient-to-t from-red-600 to-red-500 transition-all"
                              style={{ height: `${(stage.perdidos / max) * 100}%` }}
                            />
                          )}
                        </div>

                        <div className="text-center w-full">
                          <div className="text-sm font-semibold text-slate-900">{stage.label}</div>
                          {stage.perdidos > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-xs text-red-600 font-bold">
                                {stage.perdidos} perdidos ({lossRate}%)
                              </div>
                              {stage.motivosPerdas.length > 0 && (
                                <div className="text-xs space-y-0.5">
                                  {stage.motivosPerdas.map(m => (
                                    <div key={m.motivo} className="text-red-500">
                                      {m.motivo} ({m.count})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>

                      {i < funnel.stages.length - 1 && (
                        <div className="flex flex-col items-center gap-1 mb-4">
                          <ChevronRight className="h-5 w-5 text-slate-300" />
                          <div className="text-[10px] text-slate-500 font-medium">
                            {(((funnel.stages[i + 1].count / stage.count) * 100)).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                Funil real baseado no histórico completo de cada negócio no Pipedrive. Vermelho = perdidos. Clique em uma etapa para ver os criativos.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedStage ? `Detalhes — ${selectedStage.label}` : 'Detalhes por Etapa'}
                </CardTitle>
                {selectedStage && (
                  <p className="text-xs text-slate-500 mt-1">
                    {allCreatives.length} criativos{selectedStage.motivosPerdas.length > 0 ? ` • Perdidos: ${selectedStage.perdidos}` : ''}
                  </p>
                )}
              </div>
              {selected && (
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedStage && (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-slate-500">Clique em uma etapa do funil acima para ver detalhes</p>
                </div>
              )}
              {selectedStage && selectedStage.motivosPerdas.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm font-semibold text-red-900 mb-2">Motivos de Perda</div>
                  <div className="space-y-1.5">
                    {selectedStage.motivosPerdas.map(m => (
                      <div key={m.motivo} className="flex items-center justify-between text-xs">
                        <span className="text-red-700">{m.motivo}</span>
                        <span className="font-bold text-red-600">{m.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedStage && selectedStage.objecoes.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm font-semibold text-yellow-900 mb-2">Tags de Objeção</div>
                  <div className="space-y-1.5">
                    {selectedStage.objecoes.map(o => (
                      <div key={o.tag} className="flex items-center justify-between text-xs">
                        <span className="text-yellow-700">{o.tag}</span>
                        <span className="font-bold text-yellow-600">{o.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedStage && allCreatives.length === 0 && selectedStage.motivosPerdas.length === 0 && selectedStage.objecoes.length === 0 && (
                <p className="text-sm text-slate-500">Sem dados nesta etapa no período.</p>
              )}
              {selectedStage && allCreatives.length > 0 && (
                <div className="pt-2">
                  <div className="text-sm font-semibold text-slate-900 mb-2">Criativos Top 5</div>
                  <div className="space-y-2">
                    {allCreatives.map((c, idx) => (
                      <CreativeRow key={`${c.anuncio}-${idx}`} creative={c} rank={idx + 1} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {funnel.insights.length === 0 && (
                <p className="text-sm text-slate-500">Sem insights disponíveis para o período.</p>
              )}
              {funnel.insights.map(i => <FunnelInsightRow key={i.id} insight={i} />)}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function CreativeRow({ creative, rank }: { creative: FunnelTopCreative; rank: number }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:shadow-sm hover:border-blue-300 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded px-2.5 py-1 w-7 text-center">#{rank}</span>
            <span className="font-medium text-slate-900 break-words flex-1">{creative.anuncio}</span>
          </div>
          {(creative.campanha || creative.conjunto) && (
            <div className="text-xs text-slate-600 mt-2 ml-10">
              <span className="font-medium">{creative.campanha}</span> / <span>{creative.conjunto}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-blue-600">{creative.count}</div>
          <div className="text-xs text-slate-500">{formatPercent(creative.pct, 0)}</div>
        </div>
      </div>
    </div>
  )
}

function FunnelInsightRow({ insight }: { insight: Insight }) {
  const Icon = insight.severity === 'critical' ? AlertTriangle : insight.severity === 'good' ? TrendingUp : Info
  const colorMap = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    good: 'border-green-200 bg-green-50 text-green-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700'
  }

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', colorMap[insight.severity])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 flex-shrink-0" />
      <span>{insight.text}</span>
    </div>
  )
}
