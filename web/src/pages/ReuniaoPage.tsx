import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, Maximize, Plus, Trash2 } from 'lucide-react'
import { useFilters } from '@/lib/FilterContext'
import { useDecisions } from '@/lib/useDecisions'
import { KpiCard } from '@/components/KpiCard'
import { CreativesTable } from '@/components/CreativesTable'
import { InsightsPage } from '@/pages/InsightsPage'
import { formatBRL, formatNumber, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STEPS = ['Resumo Executivo', 'Top 10 Criativos', 'Top 10 Piores', 'Funil', 'Pipeline Envelhecido', 'Insights', 'Decisões da Semana']

export function ReuniaoPage() {
  const navigate = useNavigate()
  const { data, filteredCreatives } = useFilters()
  const [step, setStep] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setStep(s => Math.min(STEPS.length - 1, s + 1))
      if (e.key === 'ArrowLeft') setStep(s => Math.max(0, s - 1))
      if (e.key === 'Escape') navigate('/')
      if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
        else document.exitFullscreen().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (!data) return null

  const top10 = [...filteredCreatives].sort((a, b) => b.receita - a.receita).slice(0, 10)
  const worst10 = [...filteredCreatives].filter(c => c.investimento > 0).sort((a, b) => a.roas - b.roas).slice(0, 10)

  return (
    <div className="flex min-h-screen flex-col bg-background text-lg">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-bold">Vivera Insights — Modo Reunião</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}><X className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="flex flex-1 items-stretch">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex w-14 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <main className="flex-1 overflow-y-auto p-8">
          <h1 className="mb-6 text-2xl font-bold">{STEPS[step]}</h1>

          {step === 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard label="Receita" metric={data.kpis.receita} format={formatBRL} />
              <KpiCard label="Compras" metric={data.kpis.compras} format={formatNumber} />
              <KpiCard label="Ticket Médio" metric={data.kpis.ticketMedio} format={formatBRL} />
              <KpiCard label="Investimento" metric={data.kpis.investimento} format={formatBRL} invert />
              <KpiCard label="ROAS" metric={data.kpis.roas} format={n => `${n.toFixed(2)}x`} />
              <KpiCard label="CAC" metric={data.kpis.cac} format={formatBRL} invert />
            </div>
          )}
          {step === 1 && <CreativesTable rows={top10} />}
          {step === 2 && <CreativesTable rows={worst10} />}
          {step === 3 && <FunnelStep />}
          {step === 4 && <PipelineStep />}
          {step === 5 && <InsightsPage />}
          {step === 6 && <DecisionsStep />}
        </main>

        <button
          onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
          className="flex w-14 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <footer className="flex items-center justify-center gap-1.5 border-t border-border px-6 py-3">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${i === step ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </footer>
    </div>
  )
}

function FunnelStep() {
  const { data } = useFilters()
  if (!data) return null
  const max = data.funnel.stages[0]?.count || 1
  return (
    <div className="flex flex-col gap-4">
      {data.funnel.stages.map(s => (
        <div key={s.key} className="flex items-center gap-4">
          <div className="w-40 shrink-0 font-semibold">{s.label}</div>
          <div className="h-4 flex-1 rounded-full bg-muted">
            <div className="h-4 rounded-full bg-accent" style={{ width: `${Math.max(3, (s.count / max) * 100)}%` }} />
          </div>
          <div className="w-24 shrink-0 text-right tabular-nums">{formatNumber(s.count)}</div>
          <div className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{formatPercent(s.pctFromStart, 0)}</div>
        </div>
      ))}
    </div>
  )
}

function PipelineStep() {
  const { data } = useFilters()
  if (!data) return null
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {data.pipeline.buckets.map(b => (
        <div key={b.label} className="rounded-lg border border-border p-4">
          <div className="text-xs uppercase text-muted-foreground">{b.label}</div>
          <div className="text-2xl font-bold tabular-nums">{b.count}</div>
          <div className="text-sm tabular-nums text-muted-foreground">{formatBRL(b.potentialValue)}</div>
        </div>
      ))}
    </div>
  )
}

function DecisionsStep() {
  const { decisions, add, toggle, remove } = useDecisions()
  const [text, setText] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { add(text); setText('') } }}
          placeholder="Nova decisão da semana…"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-base"
        />
        <Button onClick={() => { add(text); setText('') }}><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <ul className="flex flex-col gap-2">
        {decisions.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma decisão registrada ainda.</li>}
        {decisions.map(d => (
          <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <input type="checkbox" checked={d.done} onChange={() => toggle(d.id)} className="h-4 w-4" />
            <span className={`flex-1 text-base ${d.done ? 'text-muted-foreground line-through' : ''}`}>{d.text}</span>
            <button onClick={() => remove(d.id)} className="text-muted-foreground hover:text-critical"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Salvo neste navegador. O que não for concluído reaparece na próxima reunião.</p>
    </div>
  )
}
