import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import commercialDashboardService, { CommercialKPIs, ProfessionalConversion, LossReason } from '../services/commercialDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExportButton } from '../utils/dashboardHelpers';

const CommercialDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<CommercialKPIs | null>(null);
  const [conversions, setConversions] = useState<ProfessionalConversion[]>([]);
  const [reasons, setReasons] = useState<LossReason[]>([]);
  const [sortBy, setSortBy] = useState<keyof ProfessionalConversion>('conversionRate');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [filters.period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period);
      const data = await commercialDashboardService.getFullCommercialDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setConversions(data.conversions);
      setReasons(data.reasons);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Commercial Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period: string) => {
    const until = new Date();
    const since = new Date();

    switch (period) {
      case 'today':
        since.setDate(since.getDate());
        break;
      case 'week':
        since.setDate(since.getDate() - 7);
        break;
      case 'year':
        since.setFullYear(since.getFullYear() - 1);
        break;
      case 'month':
      default:
        since.setDate(since.getDate() - 30);
    }

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { since: fmt(since), until: fmt(until) };
  };

  const formatValue = (value: number, type: 'currency' | 'number' | 'percentage' | 'time' = 'number') => {
    switch (type) {
      case 'currency':
        return value >= 1000000
          ? `R$ ${(value / 1000000).toFixed(2)}M`
          : value >= 1000
          ? `R$ ${(value / 1000).toFixed(0)}K`
          : `R$ ${value}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'time':
        return value < 24 ? `${Math.round(value)}h` : `${Math.round(value / 24)}d`;
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  const sortedConversions = [...conversions].sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    return bVal - aVal;
  });

  const funnelData = kpis ? [
    { stage: 'Leads', value: kpis.leads, percentage: 100 },
    { stage: 'Qualificados', value: kpis.qualified, percentage: Math.round((kpis.qualified / kpis.leads) * 100) || 0 },
    { stage: 'Agendados', value: kpis.scheduled, percentage: Math.round((kpis.scheduled / kpis.leads) * 100) || 0 },
    { stage: 'Comparecidos', value: kpis.attended, percentage: Math.round((kpis.attended / kpis.leads) * 100) || 0 },
    { stage: 'Compraram', value: kpis.purchased, percentage: Math.round((kpis.purchased / kpis.leads) * 100) || 0 }
  ] : [];

  if (error) {
    return (
      <Layout title="Commercial Intelligence">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dashboard</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading || !kpis) {
    return (
      <Layout title="Commercial Intelligence">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const exportData = kpis ? [
    { 'Métrica': 'Leads', 'Valor': kpis.leads, 'Tipo': 'Quantity' },
    { 'Métrica': 'Qualificados', 'Valor': kpis.qualified, 'Tipo': 'Quantity' },
    { 'Métrica': 'Agendados', 'Valor': kpis.scheduled, 'Tipo': 'Quantity' },
    { 'Métrica': 'Comparecidos', 'Valor': kpis.attended, 'Tipo': 'Quantity' },
    { 'Métrica': 'Comprados', 'Valor': kpis.purchased, 'Tipo': 'Quantity' }
  ] : [];

  return (
    <Layout title="Commercial Intelligence" breadcrumb={['Dashboard', 'Comercial']} right={<ExportButton filename="commercial-dashboard" rows={exportData} />}>
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Leads</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.leads)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Qualificados</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.qualified)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Agendados</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.scheduled)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#f59e0b]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Comparecidos</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.attended)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#8b5cf6]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Compraram</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.purchased)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="mb-4">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Funil de Conversão — Leads até Compra</h3>
        </div>
        {funnelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v: any) => formatValue(v)} contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">Sem dados</div>
        )}
      </div>

      {/* Performance Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Performance por Profissional</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase">Profissional</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('leads')}>Leads {sortBy === 'leads' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('qualified')}>Qualif. {sortBy === 'qualified' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('scheduled')}>Agendados {sortBy === 'scheduled' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('attended')}>Comparecidos {sortBy === 'attended' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('purchased')}>Compraram {sortBy === 'purchased' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('conversionRate')}>Taxa Conv. {sortBy === 'conversionRate' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase cursor-pointer hover:text-[#3b82f6]" onClick={() => setSortBy('avgTicket')}>Ticket {sortBy === 'avgTicket' ? '↓' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {sortedConversions.map((prof) => (
                <tr key={prof.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] cursor-pointer" onClick={() => setExpandedRow(expandedRow === prof.id ? null : prof.id)}>
                  <td className="px-5 py-3 font-semibold text-[#0f172a]"><span className="mr-2 text-[#94a3b8]">{expandedRow === prof.id ? '▾' : '▸'}</span>{prof.name}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.leads)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.qualified)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.scheduled)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.attended)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.purchased)}</td>
                  <td className="px-3 py-3 text-right"><span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: prof.conversionRate >= 20 ? '#10b981' : '#f59e0b', backgroundColor: prof.conversionRate >= 20 ? '#dcfce7' : '#fef3c7' }}>{formatValue(prof.conversionRate, 'percentage')}</span></td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.avgTicket, 'currency')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {conversions.length === 0 && <div className="text-center py-8 text-gray-500">Nenhum profissional</div>}
      </div>

      {/* Loss Reasons */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Top 5 — Motivos de Perda</h3>
        </div>
        <div className="divide-y divide-[#f1f5f9]">
          {reasons.map((reason, index) => (
            <div key={index} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold text-[#0f172a]">{index + 1}. {reason.reason}</div>
                <div className="text-[12px] text-[#94a3b8]">{reason.quantity} ({formatValue(parseFloat(reason.percentage as any), 'percentage')})</div>
              </div>
              <div className="w-full bg-[#e2e8f0] rounded-full h-2"><div className="bg-[#ef4444] h-2 rounded-full" style={{ width: `${reason.percentage}%` }} /></div>
            </div>
          ))}
        </div>
        {reasons.length === 0 && <div className="text-center py-8 text-gray-500">Sem motivos registrados</div>}
      </div>
    </Layout>
  );
};

export default CommercialDashboard;
