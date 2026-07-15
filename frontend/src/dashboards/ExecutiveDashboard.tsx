import React, { useEffect, useState } from 'react';
import { KPICard, TopBar, Layout } from '../components';
import dashboardService, {
  ExecutiveKPIs,
  ChartDataPoint,
  FunnelStage,
  Alert
} from '../services/dashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExportButton } from '../utils/dashboardHelpers';

const ExecutiveDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ExecutiveKPIs | null>(null);
  const [revenueChart, setRevenueChart] = useState<ChartDataPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadDashboardData();
  }, [filters.period]); // Recarregar quando período muda

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calcular data range baseado no filtro de período
      const dateRange = getDateRange(filters.period);

      // Buscar todos os dados em paralelo
      const data = await dashboardService.getFullExecutiveDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setRevenueChart(data.revenueChart);
      setFunnel(data.funnel);
      setAlerts(data.alerts);

      // Notificar usuário se houver alertas críticos
      if (data.alerts.some(a => a.severity === 'critical')) {
        addNotification('warning', 'Existem alertas críticos no dashboard');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Executive Dashboard:', err);
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

  if (error) {
    return (
      <Layout title="Executive Dashboard">
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
      <Layout title="Executive Dashboard">
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
    {
      'Métrica': 'Receita',
      'Valor': kpis.revenue.value,
      'Mudança': kpis.revenue.change,
      'Descrição': kpis.revenue.sub
    },
    {
      'Métrica': 'Meta',
      'Valor': kpis.goal.value,
      'Mudança': '-',
      'Descrição': kpis.goal.sub || 'Meta'
    },
    {
      'Métrica': 'Lucro',
      'Valor': kpis.profit.value,
      'Mudança': kpis.profit.change,
      'Descrição': 'Lucro líquido'
    },
    {
      'Métrica': 'Margem',
      'Valor': `${kpis.margin.value}%`,
      'Mudança': kpis.margin.change,
      'Descrição': 'Margem de lucro'
    },
    {
      'Métrica': 'ROI',
      'Valor': `${kpis.roi.value}%`,
      'Mudança': kpis.roi.change,
      'Descrição': 'Retorno sobre investimento'
    },
    {
      'Métrica': 'ROAS',
      'Valor': `${kpis.roas.value}x`,
      'Mudança': kpis.roas.change,
      'Descrição': 'Return on ad spend'
    },
    {
      'Métrica': 'CAC',
      'Valor': kpis.cac.value,
      'Mudança': kpis.cac.change,
      'Descrição': 'Custo de aquisição do cliente'
    },
    {
      'Métrica': 'Ticket Médio',
      'Valor': kpis.avgTicket.value,
      'Mudança': kpis.avgTicket.change,
      'Descrição': 'Ticket médio'
    },
    {
      'Métrica': 'Leads',
      'Valor': kpis.leads.value,
      'Mudança': kpis.leads.change,
      'Descrição': 'Total de leads'
    },
    {
      'Métrica': 'Qualificados',
      'Valor': kpis.qualified.value,
      'Mudança': kpis.qualified.change,
      'Descrição': 'Leads qualificados'
    },
    {
      'Métrica': 'Vendas',
      'Valor': kpis.sales.value,
      'Mudança': kpis.sales.change,
      'Descrição': 'Total de vendas'
    }
  ] : [];

  return (
    <Layout title="Executive Dashboard" breadcrumb={['Dashboard', 'Executive']} right={<ExportButton filename="executive-dashboard" rows={exportData} />}>
      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${
                alert.severity === 'critical'
                  ? 'bg-red-50 border-red-200'
                  : alert.severity === 'high'
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="font-semibold text-sm">{alert.title}</div>
              <div className="text-sm text-gray-700 mt-1">{alert.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Row 1 (9 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-3 mb-6">
        <KPICard
          label="Receita"
          value={`R$ ${(kpis.revenue.value as number / 1000000).toFixed(1)}M`}
          change={kpis.revenue.change}
          sub={kpis.revenue.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Meta"
          value={`R$ ${(kpis.goal.value as number / 1000000).toFixed(1)}M`}
          sub="Meta"
          accent="#6366f1"
        />
        <KPICard
          label="% Meta"
          value={`${kpis.goalPct.value}%`}
          change={kpis.goalPct.change}
          sub="progresso"
          accent="#6366f1"
        />
        <KPICard
          label="Forecast"
          value={`R$ ${(kpis.forecast.value as number / 1000000).toFixed(1)}M`}
          change={kpis.forecast.change}
          sub="projetado"
          accent="#6366f1"
        />
        <KPICard
          label="Lucro"
          value={`R$ ${(kpis.profit.value as number / 1000).toFixed(0)}K`}
          change={kpis.profit.change}
          accent="#10b981"
        />
        <KPICard
          label="Margem"
          value={`${kpis.margin.value}%`}
          change={kpis.margin.change}
          accent="#10b981"
        />
        <KPICard
          label="ROI"
          value={`${kpis.roi.value}%`}
          change={kpis.roi.change}
          accent="#8b5cf6"
        />
        <KPICard
          label="ROAS"
          value={`${kpis.roas.value}x`}
          change={kpis.roas.change}
          accent="#8b5cf6"
        />
        <KPICard
          label="CAC"
          value={`R$ ${kpis.cac.value}`}
          change={kpis.cac.change}
          accent="#0ea5e9"
        />
      </div>

      {/* KPI Row 2 (8 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 mb-6">
        <KPICard
          label="Ticket Médio"
          value={`R$ ${kpis.avgTicket.value}`}
          change={kpis.avgTicket.change}
          accent="#6366f1"
        />
        <KPICard
          label="Consultas Hoje"
          value={kpis.appointmentsToday.value}
          sub={kpis.appointmentsToday.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Consultas Amanhã"
          value={kpis.appointmentsTomorrow.value}
          sub={kpis.appointmentsTomorrow.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Comparecimento"
          value={`${kpis.attendance.value}%`}
          change={kpis.attendance.change}
          accent="#10b981"
        />
        <KPICard
          label="No-show"
          value={kpis.noShow.value}
          change={kpis.noShow.change}
          accent="#ef4444"
        />
        <KPICard
          label="Leads"
          value={kpis.leads.value}
          change={kpis.leads.change}
          accent="#6366f1"
        />
        <KPICard
          label="Qualificados"
          value={kpis.qualified.value}
          change={kpis.qualified.change}
          accent="#6366f1"
        />
        <KPICard
          label="Vendas"
          value={kpis.sales.value}
          change={kpis.sales.change}
          accent="#10b981"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart - 2/3 width */}
        <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-semibold text-[#0f172a]">
              Receita vs. Meta vs. Forecast
            </h3>
            <p className="text-[11px] text-[#94a3b8] mt-1">
              {filters.period === 'today' ? 'Hoje' :
               filters.period === 'week' ? 'Última semana' :
               filters.period === 'year' ? 'Último ano' :
               'Últimos 30 dias'}
            </p>
          </div>

          {revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueChart}>
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
                  tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`}
                  width={56}
                />
                <Tooltip
                  formatter={(v: any) => `R$ ${(v / 1000000).toFixed(2)}M`}
                  contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  name="Receita"
                />
                <Line
                  type="monotone"
                  dataKey="goal"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  name="Meta"
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  name="Forecast"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-500">
              Sem dados disponíveis
            </div>
          )}
        </div>

        {/* Funnel - 1/3 width */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Funil Executivo</h3>
          <p className="text-[11px] text-[#94a3b8] mt-1">Período atual</p>

          <div className="mt-4 space-y-3">
            {funnel.length > 0 ? (
              funnel.map((stage, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#475569] font-medium">{stage.stage}</span>
                    <span className="text-[#0f172a] font-semibold font-mono">
                      {stage.value.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="h-5 bg-[#f1f5f9] rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{
                        width: `${stage.pct}%`,
                        backgroundColor: ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b'][idx] || '#6366f1',
                        opacity: 0.85
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[#94a3b8] mt-0.5">{stage.pct}%</div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-8">Sem dados</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ExecutiveDashboard;
