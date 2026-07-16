import React, { useEffect, useState } from 'react';
import { KPICard, TopBar, Layout, DrillDownDrawer } from '../components';
import OriginBreakdownCard from '../components/OriginBreakdownCard';
import dashboardService, {
  ExecutiveKPIs,
  ChartDataPoint,
  FunnelStage,
  Alert
} from '../services/dashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDateRange, ExportButton } from '../utils/dashboardHelpers';

// Valores monetários em milhares: 17500 -> "R$ 17.5k", 500000 -> "R$ 500k"
const fmtK = (v: number): string => {
  if (v >= 1000) {
    const k = (v / 1000).toFixed(1).replace(/\.0$/, '');
    return `R$ ${k}k`;
  }
  return `R$ ${Math.round(v)}`;
};

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
  const [origins, setOrigins] = useState<any[]>([]);
  const [loadingOrigins, setLoadingOrigins] = useState(false);
  // Drill-down: qual KPI está "explodido" no drawer lateral
  const [drillMetric, setDrillMetric] = useState<string | null>(null);

  // Carregar dados quando filtros mudam + atualizacao automatica a cada 5 minutos
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => loadDashboardData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [filters.period, filters.dateRange]);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Calcular data range baseado no filtro de período
      const dateRange = getDateRange(filters.period, filters.dateRange);

      // Buscar todos os dados em paralelo (com período anterior para comparação)
      const data = await dashboardService.getFullExecutiveDashboard(
        dateRange.since,
        dateRange.until,
        dateRange.prevSince,
        dateRange.prevUntil
      );

      setKpis(data.kpis);
      setRevenueChart(data.revenueChart);
      setFunnel(data.funnel);
      setAlerts(data.alerts);

      // Buscar dados de origem em paralelo
      setLoadingOrigins(true);
      try {
        const originsResponse = await axios.get('/api/dashboard/executive/origins', {
          params: {
            since: dateRange.since,
            until: dateRange.until
          }
        });
        if (originsResponse.data.success) {
          setOrigins(originsResponse.data.data.byOrigin || []);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados de origem:', err);
      } finally {
        setLoadingOrigins(false);
      }

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


  if (error) {
    return (
      <Layout title="Executive Dashboard">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dashboard</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => loadDashboardData()}
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

      {/* KPI Row 1 (7 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-6">
        <KPICard
          label="Receita"
          onClick={() => setDrillMetric('revenue')}
          value={fmtK(kpis.revenue.value as number)}
          change={kpis.revenue.change}
          sub={kpis.revenue.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Meta"
          onClick={() => setDrillMetric('goal')}
          value={fmtK(kpis.goal.value as number)}
          sub="Meta"
          accent="#6366f1"
        />
        <KPICard
          label="% Meta"
          onClick={() => setDrillMetric('goalPct')}
          value={`${kpis.goalPct.value}%`}
          change={kpis.goalPct.change}
          sub="progresso"
          accent="#6366f1"
        />
        <KPICard
          label="Forecast"
          onClick={() => setDrillMetric('forecast')}
          value={fmtK(kpis.forecast.value as number)}
          change={kpis.forecast.change}
          sub="projetado"
          accent="#6366f1"
        />
        <KPICard
          label="ROI"
          onClick={() => setDrillMetric('roi')}
          value={`${kpis.roi.value}%`}
          change={kpis.roi.change}
          accent="#8b5cf6"
        />
        <KPICard
          label="ROAS"
          onClick={() => setDrillMetric('roas')}
          value={`${kpis.roas.value}x`}
          change={kpis.roas.change}
          accent="#8b5cf6"
        />
        <KPICard
          label="CAC"
          onClick={() => setDrillMetric('cac')}
          value={`R$ ${kpis.cac.value}`}
          change={kpis.cac.change}
          accent="#0ea5e9"
        />
      </div>

      {/* KPI Row 2 (8 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 mb-6">
        <KPICard
          label="Ticket Médio"
          onClick={() => setDrillMetric('avgTicket')}
          value={`R$ ${kpis.avgTicket.value}`}
          change={kpis.avgTicket.change}
          accent="#6366f1"
        />
        <KPICard
          label="Agendamentos Hoje"
          onClick={() => setDrillMetric('appointmentsToday')}
          value={kpis.appointmentsToday.value}
          sub={kpis.appointmentsToday.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Agenda Amanhã"
          onClick={() => setDrillMetric('appointmentsTomorrow')}
          value={kpis.appointmentsTomorrow.value}
          sub={kpis.appointmentsTomorrow.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Comparecimento"
          onClick={() => setDrillMetric('attendance')}
          value={`${kpis.attendance.value}%`}
          change={kpis.attendance.change}
          accent="#10b981"
        />
        <KPICard
          label="No-show"
          onClick={() => setDrillMetric('noShow')}
          value={kpis.noShow.value}
          change={kpis.noShow.change}
          accent="#ef4444"
        />
        <KPICard
          label="Leads"
          onClick={() => setDrillMetric('leads')}
          value={kpis.leads.value}
          change={kpis.leads.change}
          accent="#6366f1"
        />
        <KPICard
          label="Qualificados"
          onClick={() => setDrillMetric('qualified')}
          value={kpis.qualified.value}
          change={kpis.qualified.change}
          accent="#6366f1"
        />
        <KPICard
          label="Vendas"
          onClick={() => setDrillMetric('sales')}
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
                  tickFormatter={(v) => fmtK(v)}
                  width={56}
                />
                <Tooltip
                  formatter={(v: any) => fmtK(v)}
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

      {/* BREAKDOWN POR ORIGEM */}
      <div className="mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Leads por Origem</h3>
          <p className="text-[11px] text-[#94a3b8] mt-1">Google, Instagram, Meta, Indicação</p>
          <div className="mt-4">
            <OriginBreakdownCard data={origins} loading={loadingOrigins} />
          </div>
        </div>
      </div>

      {/* Drill-down: explode a lista que popula o KPI clicado */}
      {drillMetric && (() => {
        const r = getDateRange(filters.period, filters.dateRange);
        return (
          <DrillDownDrawer
            metric={drillMetric}
            since={r.since}
            until={r.until}
            onClose={() => setDrillMetric(null)}
          />
        );
      })()}
    </Layout>
  );
};

export default ExecutiveDashboard;
