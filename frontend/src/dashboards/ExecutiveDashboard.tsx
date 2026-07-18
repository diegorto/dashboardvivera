import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Layout } from '../components'
import {
  leadsDaily, leadsBySource,
  leadsMetaDaily, leadsGoogleDaily, leadsMetaStats, leadsGoogleStats,
  tempoFunilData, faltasData, faltasPorSDR, cancelamentosData,
  vendasPorFunil, velocidadeResposta, leadsPerdidos,
  revenueVsGoal, revenueBySource, revenueByProcedure,
  professionalRanking, executiveFunnel, alertsData,
} from '../data/mockData'

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6']

const fmt = (n: number | undefined | null) => {
  const v = typeof n === 'number' && !isNaN(n) ? n : 0
  return 'R$ ' + (v >= 1000000
    ? (v / 1000000).toFixed(1) + 'M'
    : v >= 1000
    ? (v / 1000).toFixed(0) + 'K'
    : v.toString())
}

export default function ExecutiveDashboard() {
  const [execData, setExecData] = useState<any>(null)
  useEffect(() => {
    axios.get('/api/dashboard/executive')
      .then(res => setExecData(res.data))
      .catch(err => console.error('Erro ao carregar dashboard executivo:', err))
  }, [])
  const d: any = execData || {}
  const execNum = (v: any, fallback = 0) => {
    const n = typeof v === 'string' ? parseFloat(v) : v
    return typeof n === 'number' && !isNaN(n) ? n : fallback
  }
  return (
    <Layout title="Executivo" breadcrumb={['Dashboards', 'Executivo']}>
    <div className="space-y-6">

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Receita</div>
          <div className="text-[32px] font-bold text-[#0f172a] tabular-nums leading-none mb-3">{fmt(execNum(d.revenue?.value))}</div>
          
          <span className="text-[12px] text-[#94a3b8]">{d.revenue?.sub || "vs. periodo anterior"}</span>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Meta de Faturamento Mensal</div>
          <div className="text-[32px] font-bold text-[#0f172a] tabular-nums leading-none mb-3">{fmt(execNum(d.goal?.value))}</div>
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-[#64748b]">Alcançado</span>
            <span className="font-semibold text-[#10b981]">{fmt(execNum(d.revenue?.value))} ({execNum(d.goalPct?.value)}%)</span>
          </div>
          <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden mb-2">
            <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${Math.min(execNum(d.goalPct?.value), 100)}%` }} />
          </div>
          <div className="text-[11px] text-[#10b981] font-medium">{execNum(d.goal?.value) - execNum(d.revenue?.value) > 0 ? `Faltam ${fmt(execNum(d.goal?.value) - execNum(d.revenue?.value))} para bater a meta` : "Meta batida!"}</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">ROAS</div>
          <div className="text-[32px] font-bold text-[#0f172a] tabular-nums leading-none mb-3">{execNum(d.roas?.value).toFixed(2)}x</div>
          
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">CAC</div>
          <div className="text-[32px] font-bold text-[#0f172a] tabular-nums leading-none mb-3">{fmt(execNum(d.cac?.value))}</div>
          
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Ticket Medio', value: fmt(execNum(d.avgTicket?.value)) },
          { label: 'Consultas Agendadas no Periodo', value: '47', sub: 'agendadas' },
          { label: 'Consultas Comparecidas no Periodo', value: '53', sub: 'comparecidas' },
          { label: 'Faltaram no Periodo', value: '10,6%', change: '-2.1%', ok: false },
          { label: 'Leads', value: String(execNum(d.leads?.value)) },
          { label: 'Qualificados', value: String(execNum(d.qualified?.value)) },
          { label: 'Vendas', value: String(execNum(d.sales?.value)) },
        ].map((k: any) => (
          <div key={k.label} className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2 leading-tight">{k.label}</div>
            <div className="text-[22px] font-bold text-[#0f172a] tabular-nums leading-none mb-1.5">{k.value}</div>
            {k.change && <span className={`text-[11px] font-semibold ${k.ok ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{k.change}</span>}
            {k.sub && <span className="text-[11px] text-[#94a3b8]">{k.sub}</span>}
          </div>
        ))}
      </div>

      {/* Quadro 1: Leads Totais */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
            <div className="w-8 h-8 rounded-lg bg-[#eef2ff] flex items-center justify-center">
              <span className="text-[#6366f1] text-sm font-bold">L</span>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0f172a]">Leads Totais - Junho 2025</div>
              <div className="text-[11px] text-[#94a3b8]">Todos os leads que entraram no periodo selecionado</div>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right"><div className="text-[28px] font-bold text-[#0f172a] tabular-nums leading-none">{execNum(d.leads?.value)}</div><div className="text-[11px] text-[#94a3b8] mt-0.5">leads totais</div></div>
            <div className="text-right"><div className="text-[20px] font-bold text-[#10b981] tabular-nums leading-none">{execNum(d.qualified?.value)}</div><div className="text-[11px] text-[#94a3b8] mt-0.5">qualificados</div></div>
            <div className="text-right"><div className="text-[20px] font-bold text-[#6366f1] tabular-nums leading-none">{execNum(d.leads?.value) > 0 ? ((execNum(d.qualified?.value) / execNum(d.leads?.value)) * 100).toFixed(1).replace(".", ",") : "0,0"}%</div><div className="text-[11px] text-[#94a3b8] mt-0.5">taxa qualif.</div></div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <span className="text-[20px] font-bold text-[#0f172a] tabular-nums leading-none">+18,3%</span>
                <span className="text-[11px] text-[#10b981] font-semibold bg-[#dcfce7] px-1.5 py-0.5 rounded-md">up</span>
              </div>
              <div className="text-[11px] text-[#94a3b8] mt-0.5">vs. mai/2025</div>
            </div>
            <div className="text-right"><div className="text-[20px] font-bold text-[#f59e0b] tabular-nums leading-none">24,5</div><div className="text-[11px] text-[#94a3b8] mt-0.5">leads/dia (media)</div></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 divide-x divide-[#f1f5f9]">
          <div className="col-span-7 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] font-semibold text-[#334155]">Evolucao diaria de leads</div>
              <div className="flex gap-2 sm:gap-3 md:gap-4 lg:gap-6" text-[11px] text-[#64748b]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#6366f1] inline-block rounded" />Leads totais</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#10b981] inline-block rounded" />Qualificados</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={leadsDaily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradQual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                <Area type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} fill="url(#gradLeads)" name="Leads" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="qualificados" stroke="#10b981" strokeWidth={2} fill="url(#gradQual)" name="Qualificados" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-5 p-5">
            <div className="text-[12px] font-semibold text-[#334155] mb-3">Leads por fonte</div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {['Fonte', 'Leads', '%', 'Qualif.', 'Conv.'].map((h: any) => (
                    <th key={h} className="text-left pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsBySource.map((s: any) => (
                  <tr key={s.source} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1 sm:gap-2 md:gap-3"">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="font-medium text-[#334155] whitespace-nowrap">{s.source}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-bold text-[#0f172a] tabular-nums">{s.leads}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="text-[#64748b] tabular-nums text-[10px]">{s.pct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[#334155] tabular-nums">{s.qualificados}</td>
                    <td className="py-2.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ color: s.conv >= 60 ? '#16a34a' : s.conv >= 50 ? '#d97706' : '#dc2626', backgroundColor: s.conv >= 60 ? '#dcfce7' : s.conv >= 50 ? '#fef3c7' : '#fee2e2' }}>
                        {s.conv}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#e2e8f0]">
                  <td className="pt-2.5 font-bold text-[#0f172a] text-[11px]">Total</td>
                  <td className="pt-2.5 font-bold text-[#0f172a] tabular-nums">{execNum(d.leads?.value)}</td>
                  <td className="pt-2.5 text-[#94a3b8] text-[10px]">100%</td>
                  <td className="pt-2.5 font-bold text-[#0f172a] tabular-nums">{execNum(d.qualified?.value)}</td>
                  <td className="pt-2.5"><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#dcfce7] text-[#16a34a]">{execNum(d.leads?.value) > 0 ? ((execNum(d.qualified?.value) / execNum(d.leads?.value)) * 100).toFixed(1).replace(".", ",") : "0,0"}%</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Vendas e Faturamento por Funil */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
            <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] flex items-center justify-center">
              <span className="text-[#16a34a] text-sm font-bold">$</span>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0f172a]">Vendas e Faturamento por Funil - Junho 2025</div>
              <div className="text-[11px] text-[#94a3b8]">Receita gerada por cada canal de aquisicao todos os funis somados</div>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right"><div className="text-[20px] font-bold text-[#0f172a] tabular-nums">R$ 2,847M</div><div className="text-[10px] text-[#94a3b8]">receita total</div></div>
            <div className="text-right"><div className="text-[20px] font-bold text-[#0f172a] tabular-nums">{execNum(d.sales?.value)}</div><div className="text-[10px] text-[#94a3b8]">vendas fechadas</div></div>
            <div className="text-right"><div className="text-[20px] font-bold text-[#0f172a] tabular-nums">R$ 15.064</div><div className="text-[10px] text-[#94a3b8]">ticket medio geral</div></div></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-[#f1f5f9]">
          {vendasPorFunil.map((canal: any) => (
            <div key={canal.canal} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 sm:gap-2 md:gap-3"">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: canal.cor }} />
                  <span className="text-[13px] font-bold text-[#0f172a]">{canal.canal}</span>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#dcfce7] text-[#16a34a]">+{canal.vsAnterior}%</span>
              </div>
              {canal.tipo && <div className="text-[9px] text-[#94a3b8] mb-2">{canal.tipo}</div>}
              <div className="text-[18px] font-bold text-[#0f172a] tabular-nums">{fmt(canal.receita)}</div>
              <div className="text-[9px] text-[#94a3b8] mb-2">receita {canal.pctReceita}% do total</div>
              <div className="flex gap-2 sm:gap-3 md:gap-4" mb-3">
                <div><div className="text-[15px] font-bold text-[#0f172a] tabular-nums">{canal.vendas}</div><div className="text-[9px] text-[#94a3b8]">vendas</div></div>
                <div><div className="text-[15px] font-bold text-[#0f172a] tabular-nums">R$ {(canal.ticket / 1000).toFixed(0)}K</div><div className="text-[9px] text-[#94a3b8]">ticket</div></div>
              </div>
              <div className="pt-2 border-t border-[#f8fafc]">
                <div className="flex justify-between text-[9px] text-[#94a3b8] mb-1"><span>Lead Venda</span><span style={{ color: canal.cor }}>{canal.convLeadVenda}%</span></div>
                <div className="h-1.5 bg-[#f1f5f9] rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${canal.convLeadVenda}%`, backgroundColor: canal.cor }} />
                </div>
                <div className="text-[9px] text-[#94a3b8] mt-1">{canal.leads} leads</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leads Meta + Google */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
        {[
          { label: 'Meta Ads', color: '#6366f1', bg: '#eef2ff', stats: leadsMetaStats, daily: leadsMetaDaily, gradId: 'gradMeta' },
          { label: 'Google Ads', color: '#0ea5e9', bg: '#e0f2fe', stats: leadsGoogleStats, daily: leadsGoogleDaily, gradId: 'gradGoogle' },
        ].map((src) => (
          <div key={src.label} className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-1 sm:gap-2 md:gap-3".5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: src.bg, color: src.color }}>
                  {src.label === 'Meta Ads' ? 'M' : 'G'}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#0f172a]">Leads - {src.label}</div>
                  <div className="text-[10px] text-[#94a3b8]">Junho 2025</div>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#dcfce7] text-[#16a34a]">+{src.stats.vsAnterior.total}% vs mai</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-[#f1f5f9]">
              <div className="col-span-3 p-4">
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={src.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={src.gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={src.color} stopOpacity={0.15} /><stop offset="95%" stopColor={src.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                    <XAxis dataKey="day" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={22} />
                    <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="leads" stroke={src.color} strokeWidth={2} fill={`url(#${src.gradId})`} name="Leads" dot={false} activeDot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-2 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between"><span className="text-[10px] text-[#94a3b8]">Total leads</span><span className="text-[14px] font-bold text-[#0f172a] tabular-nums">{src.stats.total}</span></div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-[#94a3b8]">Qualificados</span>
                    <span className="text-[11px] font-bold text-[#10b981] tabular-nums">{src.stats.pctQualificados}%</span>
                  </div>
                  <div className="h-1 bg-[#f1f5f9] rounded-full"><div className="h-full rounded-full bg-[#10b981]" style={{ width: `${src.stats.pctQualificados}%` }} /></div>
                  <div className="text-[9px] text-[#94a3b8] mt-0.5">{src.stats.qualificados} qualificados</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-[#94a3b8]">Agendamento</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: src.color }}>{src.stats.pctAgendamento}%</span>
                  </div>
                  <div className="h-1 bg-[#f1f5f9] rounded-full"><div className="h-full rounded-full" style={{ width: `${src.stats.pctAgendamento}%`, backgroundColor: src.color }} /></div>
                  <div className="text-[9px] text-[#94a3b8] mt-0.5">{src.stats.agendados} agendados</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-[#94a3b8]">Comparecimento</span>
                    <span className="text-[11px] font-bold text-[#10b981] tabular-nums">{src.stats.pctComparecimento}%</span>
                  </div>
                  <div className="h-1 bg-[#f1f5f9] rounded-full"><div className="h-full rounded-full bg-[#10b981]" style={{ width: `${src.stats.pctComparecimento}%` }} /></div>
                  <div className="text-[9px] text-[#94a3b8] mt-0.5">{src.stats.compareceram} compareceram {src.stats.pctCompVsTotal}% do total</div>
                </div>
                <div className="flex items-center justify-between"><span className="text-[10px] text-[#94a3b8]">Receita gerada</span><span className="text-[12px] font-bold text-[#0f172a] tabular-nums">{fmt(src.stats.receita)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[10px] text-[#94a3b8]">Ticket medio</span><span className="text-[11px] font-bold text-[#0f172a] tabular-nums">{fmt(src.stats.ticketMedio)}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tempos no Funil: 4, 5, 6 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#fef3c7] flex items-center justify-center text-xs font-bold text-[#d97706]">4</div>
            <div><div className="text-[13px] font-semibold text-[#0f172a]">Lead Agendamento</div><div className="text-[10px] text-[#94a3b8]">Tempo medio desde entrada ate agendar</div></div>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: 'Total', color: '#6366f1', data: tempoFunilData.leadToAgendamento.total },
              { label: 'Meta Ads', color: '#8b5cf6', data: tempoFunilData.leadToAgendamento.meta },
              { label: 'Google Ads', color: '#0ea5e9', data: tempoFunilData.leadToAgendamento.google },
            ].map((c) => (
              <div key={c.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 sm:gap-2 md:gap-3""><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /><span className="text-[12px] font-semibold text-[#334155]">{c.label}</span></div>
                  <span className="text-[18px] font-bold text-[#0f172a] tabular-nums">{c.data.media}d</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-[#f8fafc] rounded-lg px-3 py-2 text-center"><div className="text-[11px] font-bold text-[#334155] tabular-nums">{c.data.mediana}d</div><div className="text-[9px] text-[#94a3b8]">mediana</div></div>
                  <div className="bg-[#f8fafc] rounded-lg px-3 py-2 text-center"><div className="text-[11px] font-bold text-[#334155] tabular-nums">{c.data.p90}d</div><div className="text-[9px] text-[#94a3b8]">p90</div></div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-[#f1f5f9]">
              <div className="text-[10px] text-[#94a3b8] mb-2">Evolucao mensal (dias)</div>
              <ResponsiveContainer width="100%" height={70}>
                <LineChart data={tempoFunilData.trend} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={1.5} dot={false} name="Total" />
                  <Line type="monotone" dataKey="meta" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Meta" />
                  <Line type="monotone" dataKey="google" stroke="#0ea5e9" strokeWidth={1.5} dot={false} name="Google" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#dcfce7] flex items-center justify-center text-xs font-bold text-[#16a34a]">5</div>
            <div><div className="text-[13px] font-semibold text-[#0f172a]">Indicacao Agendamento</div><div className="text-[10px] text-[#94a3b8]">Tempo medio desde indicacao ate agendar</div></div>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <div><div className="text-[42px] font-bold text-[#10b981] tabular-nums leading-none">{tempoFunilData.indicacaoToAgendamento.media}d</div><div className="text-[11px] text-[#94a3b8] mt-1">tempo medio</div></div>
              <div className="text-right"><div className="text-[13px] font-semibold text-[#10b981]">Melhor canal</div><div className="text-[11px] text-[#64748b]">vs 2,8d total</div><div className="text-[11px] font-bold text-[#10b981]">-50% mais rapido</div></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[{ label: 'Mediana', value: `${tempoFunilData.indicacaoToAgendamento.mediana}d` }, { label: 'P90', value: `${tempoFunilData.indicacaoToAgendamento.p90}d` }, { label: 'Conv.', value: `${tempoFunilData.indicacaoToAgendamento.pctConv}%` }].map((s: any) => (
                <div key={s.label} className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-3 py-2.5 text-center"><div className="text-[13px] font-bold text-[#0f172a] tabular-nums">{s.value}</div><div className="text-[9px] text-[#94a3b8] mt-0.5">{s.label}</div></div>
              ))}
            </div>
            <div className="space-y-2 pt-2 border-t border-[#f1f5f9]">
              <div className="text-[10px] text-[#94a3b8] font-medium">Comparativo com outros canais</div>
              {[{ label: 'Indicacao', dias: 1.4, color: '#10b981' }, { label: 'Meta Ads', dias: 2.3, color: '#6366f1' }, { label: 'Total', dias: 2.8, color: '#64748b' }, { label: 'Google Ads', dias: 3.6, color: '#0ea5e9' }].map((c) => (
                <div key={c.label} className="flex items-center gap-2 sm:gap-3 md:gap-4"">
                  <div className="w-20 text-[10px] text-[#475569] shrink-0">{c.label}</div>
                  <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full"><div className="h-full rounded-full" style={{ width: `${(c.dias / 4) * 100}%`, backgroundColor: c.color }} /></div>
                  <div className="w-8 text-[10px] font-semibold text-[#0f172a] tabular-nums text-right">{c.dias}d</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#f1f5f9]"><span className="text-[11px] text-[#64748b]">Total de indicacoes no periodo</span><span className="text-[14px] font-bold text-[#0f172a]">98</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] text-[#64748b]">Agendados</span><span className="text-[14px] font-bold text-[#10b981]">79 (80,6%)</span></div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ede9fe] flex items-center justify-center text-xs font-bold text-[#7c3aed]">6</div>
            <div><div className="text-[13px] font-semibold text-[#0f172a]">Lead Venda</div><div className="text-[10px] text-[#94a3b8]">Tempo medio desde entrada ate fechar compra</div></div>
          </div>
          <div className="p-5 flex flex-col gap-4">
            {[
              { label: 'Total', color: '#8b5cf6', data: tempoFunilData.leadToVenda.total },
              { label: 'Meta Ads', color: '#6366f1', data: tempoFunilData.leadToVenda.meta },
              { label: 'Google Ads', color: '#0ea5e9', data: tempoFunilData.leadToVenda.google },
              { label: 'Indicacao', color: '#10b981', data: tempoFunilData.leadToVenda.indicacao },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between py-1.5 border-b border-[#f8fafc]">
                <div className="flex items-center gap-1 sm:gap-2 md:gap-3""><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /><span className="text-[12px] font-medium text-[#475569]">{c.label}</span></div>
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
                  <div className="text-right"><div className="text-[16px] font-bold text-[#0f172a] tabular-nums">{c.data.media}d</div><div className="text-[9px] text-[#94a3b8]">media</div></div>
                  <div className="text-right"><div className="text-[12px] font-semibold text-[#334155] tabular-nums">{c.data.mediana}d</div><div className="text-[9px] text-[#94a3b8]">mediana</div></div>
                  <div className="text-right"><div className="text-[12px] font-semibold text-[#334155] tabular-nums">{c.data.p90}d</div><div className="text-[9px] text-[#94a3b8]">p90</div></div>
                </div>
              </div>
            ))}
            <div className="bg-[#faf5ff] border border-[#ede9fe] rounded-lg px-4 py-3">
              <div className="text-[11px] font-semibold text-[#7c3aed] mb-1">Interpretacao IA</div>
              <div className="text-[11px] text-[#64748b] leading-relaxed">Leads de indicacao fecham em <strong>2,1d</strong> 49% mais rapido que a media. Aumentar o programa de indicacoes pode reduzir custo de venda e ciclo.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Faltas + Cancelamentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2 md:gap-3".5">
              <div className="w-7 h-7 rounded-lg bg-[#fee2e2] flex items-center justify-center text-xs font-bold text-[#dc2626]">7</div>
              <div><div className="text-[13px] font-semibold text-[#0f172a]">Faltas (No-show) - Junho 2025</div><div className="text-[10px] text-[#94a3b8]">Consultas em que o paciente nao apareceu sem aviso</div></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
              <div className="text-right"><div className="text-[20px] font-bold text-[#ef4444] tabular-nums">{faltasData.total}</div><div className="text-[9px] text-[#94a3b8]">faltas</div></div>
              <div className="text-right"><div className="text-[20px] font-bold text-[#ef4444] tabular-nums">{faltasData.taxa}%</div><div className="text-[9px] text-[#94a3b8]">taxa no-show</div></div>
              <div className="text-right"><div className="text-[15px] font-bold text-[#dc2626] tabular-nums">{fmt(faltasData.receitaPerdida)}</div><div className="text-[9px] text-[#94a3b8]">receita perdida</div></div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#fee2e2] text-[#dc2626]">+{faltasData.vsAnterior}pp vs mai</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-[#f1f5f9]">
            <div className="p-4">
              <div className="text-[11px] font-semibold text-[#334155] mb-3">Por SDR</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#f1f5f9]">
                    {['SDR', 'Faltas', 'Taxa', 'Receita em risco'].map((h: any) => (
                      <th key={h} className="text-left pb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8] pr-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {faltasPorSDR.map((p: any) => (
                    <tr key={p.nome} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                      <td className="py-2 pr-2 text-[#334155] font-medium">{(p.nome || '').split(' ').slice(0, 2).join(' ')}</td>
                      <td className="py-2 pr-2 font-bold text-[#ef4444] tabular-nums">{p.faltas}</td>
                      <td className="py-2 pr-2">
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${p.taxa > 12 ? 'bg-[#fee2e2] text-[#dc2626]' : p.taxa > 7 ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#dcfce7] text-[#16a34a]'}`}>{p.taxa}%</span>
                      </td>
                      <td className="py-2 text-[#64748b] tabular-nums">{fmt(p.receitaEmRisco)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4">
              <div className="text-[11px] font-semibold text-[#334155] mb-3">Faltas por dia da semana</div>
              <div className="flex gap-1 mb-4">
                {faltasData.porDia.map((d: any) => (
                  <div key={d.dia} className="flex-1 text-center">
                    <div className="mx-auto rounded-md mb-1" style={{ height: `${(d.faltas / 8) * 48}px`, minHeight: 6, backgroundColor: '#ef4444', opacity: 0.6 + (d.faltas / 8) * 0.4, width: '100%' }} />
                    <div className="text-[9px] text-[#94a3b8]">{d.dia}</div>
                    <div className="text-[10px] font-bold text-[#334155]">{d.faltas}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] font-semibold text-[#334155] mb-2">Ultimas faltas</div>
              <div className="space-y-1.5">
                {faltasData.ultimasFaltas.slice(0, 4).map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-[#f8fafc]">
                    <div><span className="font-semibold text-[#334155]">{f.paciente}</span><span className="text-[#94a3b8] ml-1.5">{f.data} {f.horario}</span></div>
                    <div className="text-right"><span className="text-[#0f172a] font-semibold">{f.valor}</span><span className="text-[#94a3b8] ml-1.5">{f.procedimento}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-[#f1f5f9]">
                <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6366f1] hover:text-[#4f46e5] transition-colors">
                  <span>*</span> IA Executiva - Interpretar com IA
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2 md:gap-3".5">
              <div className="w-7 h-7 rounded-lg bg-[#fef3c7] flex items-center justify-center text-xs font-bold text-[#d97706]">8</div>
              <div><div className="text-[13px] font-semibold text-[#0f172a]">Cancelamentos / Desmarques - Junho 2025</div><div className="text-[10px] text-[#94a3b8]">Consultas desmarcadas com ou sem reagendamento</div></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
              <div className="text-right"><div className="text-[20px] font-bold text-[#f59e0b] tabular-nums">{cancelamentosData.total}</div><div className="text-[9px] text-[#94a3b8]">cancelamentos</div></div>
              <div className="text-right"><div className="text-[20px] font-bold text-[#f59e0b] tabular-nums">{cancelamentosData.taxa}%</div><div className="text-[9px] text-[#94a3b8]">taxa canc.</div></div>
              <div className="text-right"><div className="text-[15px] font-bold text-[#10b981] tabular-nums">{cancelamentosData.pctReagendado}%</div><div className="text-[9px] text-[#94a3b8]">reagendados</div></div>
              <div className="text-right"><div className="text-[14px] font-bold text-[#dc2626] tabular-nums">{fmt(cancelamentosData.receitaPerdida)}</div><div className="text-[9px] text-[#94a3b8]">receita perdida</div></div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#fef3c7] text-[#d97706]">+{cancelamentosData.vsAnterior}pp vs mai</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-[#f1f5f9]">
            <div className="p-4">
              <div className="text-[11px] font-semibold text-[#334155] mb-3">Motivos de cancelamento</div>
              <div className="space-y-2 mb-4">
                {cancelamentosData.porMotivo.map((m: any) => (
                  <div key={m.motivo}>
                    <div className="flex justify-between text-[10px] mb-1"><span className="text-[#475569]">{m.motivo}</span><span className="font-bold text-[#0f172a]">{m.count} <span className="text-[#94a3b8] font-normal">({m.pct}%)</span></span></div>
                    <div className="h-1.5 bg-[#f1f5f9] rounded-full"><div className="h-full rounded-full bg-[#f59e0b]" style={{ width: `${m.pct}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="bg-[#f8fafc] rounded-lg px-3 py-2.5 flex items-center justify-between">
                <span className="text-[10px] text-[#64748b]">Antecedencia media do aviso</span>
                <span className="text-[13px] font-bold text-[#0f172a]">{cancelamentosData.antecedenciaMedia}h antes</span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-3 py-2 text-center">
                  <div className="text-[13px] font-bold text-[#16a34a]">{cancelamentosData.reagendados}</div>
                  <div className="text-[9px] text-[#94a3b8]">reagendados</div>
                  <div className="text-[11px] font-semibold text-[#16a34a]">{fmt(cancelamentosData.receitaRecuperada)}</div>
                </div>
                <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 text-center">
                  <div className="text-[13px] font-bold text-[#dc2626]">{cancelamentosData.total - cancelamentosData.reagendados}</div>
                  <div className="text-[9px] text-[#94a3b8]">nao reagendados</div>
                  <div className="text-[11px] font-semibold text-[#dc2626]">{fmt(cancelamentosData.receitaPerdida)}</div>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="text-[11px] font-semibold text-[#334155] mb-3">Ultimos cancelamentos</div>
              <div className="space-y-2">
                {cancelamentosData.ultimosCancelamentos.map((c: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-lg border text-[10px]"
                    style={{ borderColor: c.reagendado ? '#bbf7d0' : '#fecaca', backgroundColor: c.reagendado ? '#f0fdf4' : '#fef2f2' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#0f172a]">{c.paciente}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.reagendado ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'}`}>
                        {c.reagendado ? 'Reagendado' : 'Perdido'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#64748b]"><span>{c.data} {c.horario} {c.profissional} {c.procedimento}</span><span className="font-semibold text-[#0f172a]">{c.valor}</span></div>
                    <div className="text-[#94a3b8] mt-0.5">Avisou {c.antecedencia} antes</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Velocidade de Resposta */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f1f5f9]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
              <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center">
                <span className="text-sm">&#9889;</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#0f172a]">Velocidade de Resposta - Impacto em Qualificacao, Agendamento e Comparecimento</div>
                <div className="text-[11px] text-[#94a3b8]">Tempo desde entrada do lead ate 1a resposta do SDR · Dados integrados do Tintim</div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6366f1] hover:text-[#4f46e5] transition-colors whitespace-nowrap">
              * IA Executiva - Interpretar com IA
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
            <div className="bg-[#f8fafc] rounded-xl p-4 text-center"><div className="text-[28px] font-bold text-[#0f172a] tabular-nums">{velocidadeResposta.tempoMedio} min</div><div className="text-[11px] text-[#94a3b8] mt-0.5">tempo medio de resposta</div></div>
            <div className="bg-[#f8fafc] rounded-xl p-4 text-center"><div className="text-[28px] font-bold text-[#6366f1] tabular-nums">{velocidadeResposta.pctMenos5min}%</div><div className="text-[11px] text-[#94a3b8] mt-0.5">respondidos em menos de 5 min</div></div>
            <div className="bg-[#f8fafc] rounded-xl p-4 text-center"><div className="text-[28px] font-bold text-[#10b981] tabular-nums">+{fmt(velocidadeResposta.receitaExtra)}</div><div className="text-[11px] text-[#94a3b8] mt-0.5">receita extra (rapido vs. lento)</div></div>
          </div>
        </div>
        <div className="p-5">
          <div className="text-[12px] font-semibold text-[#334155] mb-3">Conversao por faixa de tempo de resposta</div>
          <table className="w-full text-[12px] mb-4">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                {['Tempo 1a resposta', 'Leads', 'Qualificados', 'Agendados', 'Compareceram', '% Qualif.', '% Agend.', '% Compar.'].map((h: any) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {velocidadeResposta.porFaixa.map((row: any, i: number) => (
                <tr key={row.faixa} className={`border-b border-[#f8fafc] ${i === 0 ? 'bg-[#f0fdf4]' : 'hover:bg-[#f8fafc]'} transition-colors`}>
                  <td className="px-3 py-2.5 font-semibold text-[#0f172a] whitespace-nowrap">{row.faixa}</td>
                  <td className="px-3 py-2.5 tabular-nums text-[#334155]">{row.leads}</td>
                  <td className="px-3 py-2.5 tabular-nums text-[#334155]">{row.qualificados}</td>
                  <td className="px-3 py-2.5 tabular-nums text-[#334155]">{row.agendados}</td>
                  <td className="px-3 py-2.5 tabular-nums text-[#334155]">{row.compareceram}</td>
                  <td className="px-3 py-2.5"><span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: row.pctQualif >= 75 ? '#16a34a' : row.pctQualif >= 60 ? '#d97706' : '#dc2626', backgroundColor: row.pctQualif >= 75 ? '#dcfce7' : row.pctQualif >= 60 ? '#fef3c7' : '#fee2e2' }}>{row.pctQualif}%</span></td>
                  <td className="px-3 py-2.5"><span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: row.pctAgend >= 60 ? '#16a34a' : row.pctAgend >= 35 ? '#d97706' : '#dc2626', backgroundColor: row.pctAgend >= 60 ? '#dcfce7' : row.pctAgend >= 35 ? '#fef3c7' : '#fee2e2' }}>{row.pctAgend}%</span></td>
                  <td className="px-3 py-2.5"><span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: row.pctCompar >= 55 ? '#16a34a' : row.pctCompar >= 30 ? '#d97706' : '#dc2626', backgroundColor: row.pctCompar >= 55 ? '#dcfce7' : row.pctCompar >= 30 ? '#fef3c7' : '#fee2e2' }}>{row.pctCompar}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-[#fef3c7] border border-[#fde68a] rounded-lg px-4 py-3 text-[11px] text-[#92400e] leading-relaxed mb-5">
            <span className="font-bold">&#9889; Impacto da velocidade:</span> Leads respondidos em menos de 2 minutos tem taxa de qualificacao de 83,1% e agendamento de 70,8% - contra apenas 30,7% e 13,9% em respostas apos 60 minutos. Responder mais rapido gera +R$ 329K em receita no periodo.
          </div>
          <div className="text-[12px] font-semibold text-[#334155] mb-3">Tempo medio de resposta por SDR</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {velocidadeResposta.porSDR.map((sdr: any) => {
              const cor = sdr.tempo < 5 ? '#10b981' : sdr.tempo < 8 ? '#f59e0b' : '#ef4444'
              return (
                <div key={sdr.nome} className="bg-[#f8fafc] rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-[#334155] mb-2 leading-tight">{(sdr.nome || '').split(' ')[0]} {(sdr.nome || '').split(' ')[1] || ''}</div>
                  <div className="text-[18px] font-bold tabular-nums" style={{ color: cor }}>{sdr.tempo} min</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px]"><span className="text-[#94a3b8]">Qualif.</span><span className="font-semibold text-[#334155]">{sdr.pctQualif}%</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-[#94a3b8]">Agend.</span><span className="font-semibold text-[#334155]">{sdr.pctAgend}%</span></div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-[#4338ca]">Meta de velocidade</div>
              <div className="text-[11px] text-[#64748b]">Responder em menos de 5 min para maximizar qualificacao</div>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-bold text-[#4338ca] tabular-nums">{velocidadeResposta.pctMenos5min}%</div>
              <div className="text-[10px] text-[#94a3b8]">276 de 734 leads respondidos em menos de 5 min</div>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Perdidos */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f1f5f9]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
              <div className="w-8 h-8 rounded-lg bg-[#fee2e2] flex items-center justify-center text-sm font-bold text-[#dc2626]">X</div>
              <div>
                <div className="text-[13px] font-semibold text-[#0f172a]">Leads Perdidos - Motivos de Perda por Canal de Origem</div>
                <div className="text-[11px] text-[#94a3b8]">Tags de objecao e analise de churn de funil - Junho 2025</div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6366f1] hover:text-[#4f46e5] transition-colors whitespace-nowrap">
              * IA Executiva - Interpretar com IA
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 text-center"><div className="text-[26px] font-bold text-[#dc2626] tabular-nums">{leadsPerdidos.total}</div><div className="text-[11px] text-[#94a3b8] mt-0.5">leads perdidos</div></div>
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 text-center"><div className="text-[26px] font-bold text-[#dc2626] tabular-nums">{leadsPerdidos.pctDoTotal}%</div><div className="text-[11px] text-[#94a3b8] mt-0.5">do total de leads</div></div>
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 text-center"><div className="text-[26px] font-bold text-[#dc2626] tabular-nums">{fmt(leadsPerdidos.receitaNaoConvertida)}</div><div className="text-[11px] text-[#94a3b8] mt-0.5">receita nao convertida</div></div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
            <div className="col-span-4">
              <div className="text-[12px] font-semibold text-[#334155] mb-2">Top Objecoes Globais</div>
              <div className="text-[10px] text-[#94a3b8] mb-3">Tags mais frequentes em todos os canais</div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {leadsPerdidos.topObjecoes.map((obj: any) => (
                  <div key={obj.tag} className="flex items-center gap-1 px-2 py-1 bg-[#f1f5f9] rounded-lg border border-[#e2e8f0]">
                    <span className="text-[11px] font-semibold text-[#475569]">{obj.tag}</span>
                    <span className="text-[10px] font-bold text-[#0f172a]">{obj.count}</span>
                    <span className="text-[9px] text-[#94a3b8]">({obj.pct}%)</span>
                  </div>
                ))}
              </div>
              <div className="text-[12px] font-semibold text-[#334155] mb-3">Perdidos por Canal</div>
              <div className="space-y-2">
                {leadsPerdidos.porCanal.map((c) => (
                  <div key={c.canal} className="flex items-center gap-2 sm:gap-3 md:gap-4"">
                    <div className="w-24 text-[10px] text-[#475569] shrink-0 truncate">{c.canal}</div>
                    <div className="flex-1 h-5 bg-[#f1f5f9] rounded-md overflow-hidden">
                      <div className="h-full rounded-md flex items-center px-2" style={{ width: `${(c.perdidos / 120) * 100}%`, backgroundColor: c.cor + 'cc' }}>
                        <span className="text-[9px] text-white font-bold">{c.perdidos}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-[#334155] w-8 text-right">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-4">
              <div className="text-[12px] font-semibold text-[#334155] mb-3">Perdidos por Canal</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#f1f5f9]">
                    {['Canal', 'Perdidos', '%', 'Top motivo', 'Tags'].map((h: any) => (
                      <th key={h} className="text-left pb-2 text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8] pr-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leadsPerdidos.porCanal.map((c) => (
                    <tr key={c.canal} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                      <td className="py-2 pr-2"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.cor }} /><span className="font-medium text-[#334155]">{c.canal}</span></div></td>
                      <td className="py-2 pr-2 font-bold text-[#dc2626] tabular-nums">{c.perdidos}</td>
                      <td className="py-2 pr-2 text-[#64748b]">{c.pct}%</td>
                      <td className="py-2 pr-2 text-[#475569]">{c.topMotivo}</td>
                      <td className="py-2"><div className="flex gap-1">{(c.tags || []).slice(0, 2).map((t: any) => (<span key={t} className="text-[8px] font-semibold px-1 py-0.5 bg-[#f1f5f9] text-[#475569] rounded">{t}</span>))}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="col-span-4">
              <div className="text-[12px] font-semibold text-[#334155] mb-3">Motivos de Perda Detalhados</div>
              <div className="text-[10px] text-[#94a3b8] mb-3">Breakdown por canal</div>
              <div className="space-y-3">
                {leadsPerdidos.porCanal.filter((c) => c.detalhes.length > 0).map((canal: any) => (
                  <div key={canal.canal} className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                    <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: canal.cor + '18' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: canal.cor }} />
                      <span className="text-[11px] font-semibold text-[#0f172a]">{canal.canal}</span>
                      <span className="text-[10px] text-[#94a3b8] ml-auto">{canal.perdidos} perdidos</span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {canal.detalhes.map((d: any) => (
                        <div key={d.motivo} className="flex items-center justify-between text-[10px]">
                          <span className="text-[#475569]">{d.motivo}</span>
                          <span className="font-semibold text-[#0f172a]">{d.count} <span className="text-[#94a3b8] font-normal">({d.pct}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receita vs Meta + Funil Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
        <div className="col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold text-[#0f172a]">Receita Total vs. Meta de Faturamento Mensal</div>
              <div className="text-[11px] text-[#94a3b8]">Todos os funis somados Jan - Jun 2025</div>
            </div>
            <div className="flex gap-2 sm:gap-3 md:gap-4 lg:gap-6" text-[11px] text-[#64748b]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#6366f1] rounded-sm inline-block" />Receita Total</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#e2e8f0] rounded-sm inline-block" />Meta</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueVsGoal} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => 'R$' + (v / 1000000).toFixed(1) + 'M'} width={56} />
              <Tooltip formatter={(v: number) => 'R$ ' + (v / 1000000).toFixed(2) + 'M'} contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} name="Receita Total" />
              <Bar dataKey="goal" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={32} name="Meta" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[13px] font-semibold text-[#0f172a] mb-1">Funil Executivo</div>
          <div className="text-[11px] text-[#94a3b8] mb-4">Junho 2025</div>
          <div className="space-y-2.5">
            {executiveFunnel.map((stage: any, i: number) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[#475569] font-medium">{stage.stage}</span>
                  <div className="flex items-center gap-2 sm:gap-3 md:gap-4"">
                    <span className="font-bold text-[#0f172a] tabular-nums">{(stage.value || 0).toLocaleString('pt-BR')}</span>
                    <span className="text-[10px] text-[#94a3b8] w-10 text-right">{stage.pct}%</span>
                  </div>
                </div>
                <div className="h-6 bg-[#f1f5f9] rounded-md overflow-hidden">
                  <div className="h-full rounded-md flex items-center px-2" style={{ width: `${(stage.value / (execNum(d.leads?.value) || 734)) * 100}%`, backgroundColor: COLORS[i] + 'dd' }}>
                    {(stage.value / (execNum(d.leads?.value) || 734)) * 100 > 20 && <span className="text-[10px] text-white font-bold">{stage.value}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Receita por Fonte + Ranking + Receita por Procedimento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 lg:gap-6"">
        <div className="col-span-3 bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[13px] font-semibold text-[#0f172a] mb-1">Receita por Fonte</div>
          <div className="text-[11px] text-[#94a3b8] mb-3">Junho 2025</div>
          <div className="flex justify-center mb-3">
            <PieChart width={140} height={140}>
              <Pie data={revenueBySource} cx={65} cy={65} innerRadius={42} outerRadius={62} dataKey="value" stroke="none">
                {revenueBySource.map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2">
            {revenueBySource.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 sm:gap-2 md:gap-3""><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} /><span className="text-[#475569]">{s.name}</span></div>
                <span className="font-semibold text-[#0f172a] tabular-nums">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
            <div className="text-[13px] font-semibold text-[#0f172a]">Ranking - Profissionais</div>
            <button className="text-[11px] font-semibold text-[#6366f1] hover:underline">Ver todos</button>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">#</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">Profissional</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">Receita</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {professionalRanking.map((p, i) => (
                <tr key={p.name} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-bold text-[#94a3b8]">{i + 1}</td>
                  <td className="px-3 py-3"><div className="font-semibold text-[#0f172a]">{p.name}</div><div className="text-[10px] text-[#94a3b8]">{p.specialty}</div></td>
                  <td className="px-3 py-3 text-right font-bold text-[#0f172a] tabular-nums">{fmt(p.revenue)}</td>
                  <td className="px-5 py-3 text-right"><span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[#dcfce7] text-[#16a34a]">{p.conversion}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="col-span-4 bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="text-[13px] font-semibold text-[#0f172a] mb-4">Receita por Procedimento</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByProcedure} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => 'R$' + (v / 1000).toFixed(0) + 'K'} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} name="Receita">
                {revenueByProcedure.map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertas Executivos */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <div className="text-[13px] font-semibold text-[#0f172a]">Alertas Executivos</div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#dc2626]">{alertsData.length} alertas</span>
        </div>
        <div className="divide-y divide-[#f1f5f9]">
          {alertsData.map((a: any, i: number) => {
            const dot = { critical: '#ef4444', warning: '#f59e0b', success: '#10b981', info: '#6366f1' }[a.type as string] ?? '#94a3b8'
            return (
              <div key={i} className="flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6" px-5 py-3.5 hover:bg-[#f8fafc] transition-colors">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                <div className="flex-1 text-[12px] text-[#334155]">{a.text}</div>
                <div className="text-[11px] text-[#94a3b8] whitespace-nowrap">{a.time}</div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
    </Layout>
  )
}
