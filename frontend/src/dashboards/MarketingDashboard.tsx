import React, { useEffect, useState } from 'react';
import { KPICard, Layout } from '../components';
import marketingDashboardService, { MarketingKPIs, Campaign, TrendDataPoint } from '../services/marketingDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MarketingDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<MarketingKPIs | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trendChart, setTrendChart] = useState<TrendDataPoint[]>([]);
  const [sortBy, setSortBy] = useState<keyof Campaign>('revenue');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadDashboardData();
  }, [filters.period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period);
      const data = await marketingDashboardService.getFullMarketingDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setCampaigns(data.campaigns);
      setTrendChart(data.trendChart);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Marketing Dashboard:', err);
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

  const formatValue = (value: number, type: 'currency' | 'number' | 'percentage' | 'multiplier' = 'number') => {
    switch (type) {
      case 'currency':
        return value >= 1000000
          ? `R$ ${(value / 1000000).toFixed(2)}M`
          : value >= 1000
          ? `R$ ${(value / 1000).toFixed(0)}K`
          : `R$ ${value}`;
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'multiplier':
        return `${value.toFixed(1)}x`;
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    return bVal - aVal;
  });

  const statusColor: Record<string, string> = {
    Ativo: '#10b981',
    Pausado: '#f59e0b',
    Encerrado: '#ef4444'
  };

  const statusBg: Record<string, string> = {
    Ativo: '#dcfce7',
    Pausado: '#fef3c7',
    Encerrado: '#fee2e2'
  };

  if (error) {
    return (
      <Layout title="Marketing Intelligence">
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
      <Layout title="Marketing Intelligence">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Marketing Intelligence" breadcrumb={['Dashboard', 'Marketing']}>
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">
            Investimento Total
          </div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">
            {formatValue(kpis.totalInvestment, 'currency')}
          </div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#ef4444]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">
            Receita Total
          </div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">
            {formatValue(kpis.totalRevenue, 'currency')}
          </div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">
            ROAS Médio
          </div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">
            {formatValue(kpis.avgRoas, 'multiplier')}
          </div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">
            Total de Leads
          </div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">
            {formatValue(kpis.totalLeads)}
          </div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">
            Impressões Totais
          </div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">
            {kpis.totalImpressions > 0 ? formatValue(kpis.totalImpressions / 1000000, 'number') + 'M' : '—'}
          </div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#8b5cf6]" />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="mb-4">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">
            Receita vs. Investimento — Tendência Mensal
          </h3>
        </div>

        {trendChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
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
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} name="Receita" />
              <Bar dataKey="investment" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={32} name="Investimento" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-gray-500">
            Sem dados disponíveis
          </div>
        )}
      </div>

      {/* Campaigns Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Campanhas — Análise Completa</h3>
          <div className="text-[11px] text-[#64748b]">
            <span>Hierarquia: </span>
            <span className="font-semibold text-[#0f172a]">Campanha</span>
            <span className="text-[#94a3b8]"> → Ad Set → Criativo → Paciente</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">
                  Campanha
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Status</th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap"
                  onClick={() => setSortBy('investment')}
                >
                  Investimento {sortBy === 'investment' ? '↓' : ''}
                </th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap"
                  onClick={() => setSortBy('leads')}
                >
                  Leads {sortBy === 'leads' ? '↓' : ''}
                </th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap"
                  onClick={() => setSortBy('revenue')}
                >
                  Receita {sortBy === 'revenue' ? '↓' : ''}
                </th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap"
                  onClick={() => setSortBy('roas')}
                >
                  ROAS {sortBy === 'roas' ? '↓' : ''}
                </th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap"
                  onClick={() => setSortBy('revPerLead')}
                >
                  R$/Lead {sortBy === 'revPerLead' ? '↓' : ''}
                </th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:text-[#6366f1] whitespace-nowrap"
                  onClick={() => setSortBy('revPerAppt')}
                >
                  R$/Appt {sortBy === 'revPerAppt' ? '↓' : ''}
                </th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="border-b border-[#f8fafc] hover:bg-[#f8fafc] cursor-pointer transition-colors"
                  onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                >
                  <td className="px-5 py-3 font-semibold text-[#0f172a] whitespace-nowrap">
                    <span className="mr-2 text-[#94a3b8]">{expandedCampaign === campaign.id ? '▾' : '▸'}</span>
                    {campaign.name}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: statusColor[campaign.status],
                        backgroundColor: statusBg[campaign.status]
                      }}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {formatValue(campaign.investment, 'currency')}
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {formatValue(campaign.leads)}
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {formatValue(campaign.revenue, 'currency')}
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {formatValue(campaign.roas, 'multiplier')}
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {formatValue(campaign.revPerLead, 'currency')}
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {formatValue(campaign.revPerAppt, 'currency')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        color: campaign.trend >= 0 ? '#10b981' : '#ef4444',
                        backgroundColor: campaign.trend >= 0 ? '#dcfce7' : '#fee2e2'
                      }}
                    >
                      {campaign.trend >= 0 ? '+' : ''}{campaign.trend}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {campaigns.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhuma campanha encontrada
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MarketingDashboard;
