import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import financialDashboardService, { FinancialKPIs, MonthlyFinancialData } from '../services/financialDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const FinancialDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [monthly, setMonthly] = useState<MonthlyFinancialData[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [filters.period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period);
      const data = await financialDashboardService.getFullFinancialDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setMonthly(data.monthly);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Financeiro Dashboard:', err);
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
        return value >= 1000000 || value <= -1000000
          ? `R$ ${(value / 1000000).toFixed(2)}M`
          : value >= 1000 || value <= -1000
          ? `R$ ${(value / 1000).toFixed(0)}K`
          : `R$ ${value.toFixed(0)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  if (error) {
    return (
      <Layout title="Financeiro">
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
      <Layout title="Financeiro">
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
    <Layout title="Financeiro" breadcrumb={['Dashboard', 'Financeiro']}>
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Receita</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.revenue, 'currency')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Investimento Ads</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.adSpend, 'currency')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#ef4444]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Lucro Bruto</div>
          <div
            className="text-[20px] font-bold font-mono"
            style={{ color: kpis.grossProfit >= 0 ? '#0f172a' : '#ef4444' }}
          >
            {formatValue(kpis.grossProfit, 'currency')}
          </div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Margem</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.margin, 'percentage')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#f59e0b]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Ticket Médio</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.avgTicket, 'currency')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#8b5cf6]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Vendas</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.salesCount)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="mb-4">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Receita vs. Investimento vs. Lucro — Mensal</h3>
        </div>

        {monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} name="Receita" />
              <Bar dataKey="investment" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} name="Investimento" />
              <Bar dataKey="profit" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-56 flex items-center justify-center text-gray-500">Sem dados disponíveis</div>
        )}
      </div>

      {/* Monthly Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Detalhamento Mensal</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Mês</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Receita</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Investimento</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Lucro</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Margem</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={row.month} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-semibold text-[#0f172a]">{row.month}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(row.revenue, 'currency')}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(row.investment, 'currency')}</td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: row.profit >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatValue(row.profit, 'currency')}
                  </td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">
                    {row.revenue > 0 ? formatValue((row.profit / row.revenue) * 100, 'percentage') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {monthly.length === 0 && (
          <div className="text-center py-8 text-gray-500">Sem dados no período</div>
        )}
      </div>
    </Layout>
  );
};

export default FinancialDashboard;
