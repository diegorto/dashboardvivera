import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import { ExportButton } from '../utils/dashboardHelpers';
import professionalsDashboardService, { ProfessionalsKPIs, ProfessionalRanking } from '../services/professionalsDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ProfessionalsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ProfessionalsKPIs | null>(null);
  const [ranking, setRanking] = useState<ProfessionalRanking[]>([]);
  const [sortBy, setSortBy] = useState<keyof ProfessionalRanking>('revenue');

  useEffect(() => {
    loadDashboardData();
  }, [filters.period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period);
      const data = await professionalsDashboardService.getFullProfessionalsDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setRanking(data.ranking);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Profissionais Dashboard:', err);
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

  const formatValue = (value: number, type: 'currency' | 'number' | 'percentage' = 'number') => {
    switch (type) {
      case 'currency':
        return value >= 1000000
          ? `R$ ${(value / 1000000).toFixed(2)}M`
          : value >= 1000
          ? `R$ ${(value / 1000).toFixed(0)}K`
          : `R$ ${value.toFixed(0)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  const sortedRanking = [...ranking].sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    return bVal - aVal;
  });

  const chartData = sortedRanking.slice(0, 8).map(p => ({
    name: p.name.split(' ')[0],
    revenue: p.revenue
  }));

  if (error) {
    return (
      <Layout title="Profissionais">
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
      <Layout title="Profissionais">
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
    { 'Métrica': 'Total de Profissionais', 'Valor': kpis.totalProfessionals, 'Tipo': 'Quantity' },
    { 'Métrica': 'Total de Deals', 'Valor': kpis.totalDeals, 'Tipo': 'Quantity' },
    { 'Métrica': 'Deals Ganhos', 'Valor': kpis.totalWon, 'Tipo': 'Quantity' },
    { 'Métrica': 'Receita Total', 'Valor': kpis.totalRevenue, 'Tipo': 'Currency' },
    { 'Métrica': 'Receita Média por Profissional', 'Valor': kpis.avgRevenuePerProfessional, 'Tipo': 'Currency' }
  ] : [];

  return (
    <Layout title="Profissionais" breadcrumb={['Dashboard', 'Profissionais']} right={<ExportButton filename="professionals-dashboard" rows={exportData} />}>
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Profissionais</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.totalProfessionals)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Deals no Período</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.totalDeals)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Vendas</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.totalWon)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Receita Total</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.totalRevenue, 'currency')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#8b5cf6]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Receita / Profissional</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.avgRevenuePerProfessional, 'currency')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#f59e0b]" />
        </div>
      </div>

      {/* Revenue by Professional Chart */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="mb-4">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Receita por Profissional — Top 8</h3>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}K`}
                width={56}
              />
              <Tooltip
                formatter={(v: any) => formatValue(v, 'currency')}
                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} name="Receita" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-gray-500">Sem dados disponíveis</div>
        )}
      </div>

      {/* Ranking Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Ranking Completo</h3>
          <div className="text-[11px] text-[#64748b]">{ranking.length} profissionais</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">#</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Profissional</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('deals')}>Deals {sortBy === 'deals' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('open')}>Abertos {sortBy === 'open' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('won')}>Ganhos {sortBy === 'won' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('lost')}>Perdidos {sortBy === 'lost' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('conversionRate')}>Taxa Conv. {sortBy === 'conversionRate' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('avgTicket')}>Ticket Médio {sortBy === 'avgTicket' ? '↓' : ''}</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap" onClick={() => setSortBy('revenue')}>Receita {sortBy === 'revenue' ? '↓' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRanking.map((prof, index) => (
                <tr key={prof.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-mono text-[#94a3b8]">{index + 1}</td>
                  <td className="px-3 py-3 font-semibold text-[#0f172a] whitespace-nowrap">{prof.name}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.deals)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.open)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.won)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.lost)}</td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        color: prof.conversionRate >= 20 ? '#10b981' : '#f59e0b',
                        backgroundColor: prof.conversionRate >= 20 ? '#dcfce7' : '#fef3c7'
                      }}
                    >
                      {formatValue(prof.conversionRate, 'percentage')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(prof.avgTicket, 'currency')}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono font-semibold">{formatValue(prof.revenue, 'currency')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ranking.length === 0 && (
          <div className="text-center py-8 text-gray-500">Nenhum profissional encontrado</div>
        )}
      </div>
    </Layout>
  );
};

export default ProfessionalsDashboard;
