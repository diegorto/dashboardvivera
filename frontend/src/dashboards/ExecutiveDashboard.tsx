import React, { useEffect, useState } from 'react';
import { KPICard, TopBar, Layout, DrillDownDrawer } from '../components';
import OriginBreakdownCard from '../components/OriginBreakdownCard';
import RevenueByFunnelCard from '../components/RevenueByFunnelCard';
import LeadsCard from '../components/LeadsCard';
import SalesByFunnelCard from '../components/SalesByFunnelCard';
import ConversionTimeCard from '../components/ConversionTimeCard';
import NoShowCancellationCard from '../components/NoShowCancellationCard';
import ResponseSpeedCard from '../components/ResponseSpeedCard';
import LostLeadsCard from '../components/LostLeadsCard';
import ExecutiveAlertsCard from '../components/ExecutiveAlertsCard';
import dashboardService, {
  ExecutiveKPIs,
  ChartDataPoint,
  FunnelStage,
  Alert
} from '../services/dashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDateRange, ExportButton } from '../utils/dashboardHelpers';
import {
  mockLeadsCardData,
  mockSalesByFunnelCardData,
  mockConversionTimeCardData,
  mockNoShowCancellationCardData,
  mockResponseSpeedCardData,
  mockLostLeadsCardData,
  mockExecutiveAlertsCardData,
} from '../data/mockData';

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
  const [revenueByFunnel, setRevenueByFunnel] = useState<any[]>([]);
  const [loadingRevenueByFunnel, setLoadingRevenueByFunnel] = useState(false);
  const [totalRevenueByFunnel, setTotalRevenueByFunnel] = useState(0);
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

      // Buscar dados de origem e receita por funil em paralelo
      setLoadingOrigins(true);
      setLoadingRevenueByFunnel(true);
      try {
        const [originsResponse, funnelRevenueResponse] = await Promise.all([
          api.get('/dashboard/executive/origins', {
            params: {
              since: dateRange.since,
              until: dateRange.until
            }
          }),
          api.get('/dashboard/executive/funnel', {
            params: {
              since: dateRange.since,
              until: dateRange.until
            }
          })
        ]);

        if (originsResponse.data.success) {
          setOrigins(originsResponse.data.data.byOrigin || []);
        }

        if (funnelRevenueResponse.data.success) {
          const revenueData = funnelRevenueResponse.data.data.revenue;
          setRevenueByFunnel(revenueData.byPipeline || []);
          setTotalRevenueByFunnel(revenueData.total || 0);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados de origem/funnel:', err);
      } finally {
        setLoadingOrigins(false);
        setLoadingRevenueByFunnel(false);
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
    <Layout title="Executive Dashboard" breadcrumb={['Dashboard', 'Executive Dashboard']} right={<ExportButton filename="executive-dashboard" rows={exportData} />}>
      {/* Alertas Executivos */}
      <div className="mb-8">
        <ExecutiveAlertsCard
          title={mockExecutiveAlertsCardData.title}
          alerts={mockExecutiveAlertsCardData.alerts}
        />
      </div>

      {/* KPI Row 1 (4 cards wide on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Receita"
          onClick={() => setDrillMetric('revenue')}
          value={fmtK(kpis.revenue.value as number)}
          change={kpis.revenue.change}
          sub={kpis.revenue.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Meta de Faturamento Mensal"
          onClick={() => setDrillMetric('goal')}
          value={fmtK(kpis.goal.value as number)}
          progress={Math.min((kpis.revenue.value as number) / (kpis.goal.value as number) * 100, 100)}
          progressLabel="Alcançado"
          accent="#6366f1"
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

      {/* KPI Row 2 (7 cards - similar layout to screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
        <KPICard
          label="Ticket Médio"
          onClick={() => setDrillMetric('avgTicket')}
          value={`R$ ${kpis.avgTicket.value}`}
          change={kpis.avgTicket.change}
          accent="#6366f1"
        />
        <KPICard
          label="Consultas Agendadas no Período"
          onClick={() => setDrillMetric('appointmentsToday')}
          value={kpis.appointmentsToday.value}
          sub={kpis.appointmentsToday.sub}
          accent="#6366f1"
        />
        <KPICard
          label="Consultas Comparecidas no Período"
          onClick={() => setDrillMetric('attendance')}
          value={kpis.attendance.value}
          change={kpis.attendance.change}
          accent="#10b981"
        />
        <KPICard
          label="Faltaram no Período"
          onClick={() => setDrillMetric('noShow')}
          value={`${kpis.noShow.value}%`}
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

      {/* 1. LeadsCard - Leads Totais */}
      <div className="mb-8">
        <LeadsCard
          title={mockLeadsCardData.title}
          period={mockLeadsCardData.period}
          totalLeads={mockLeadsCardData.totalLeads}
          qualifiedLeads={mockLeadsCardData.qualifiedLeads}
          qualificationRate={mockLeadsCardData.qualificationRate}
          changeVsPreviousMonth={mockLeadsCardData.changeVsPreviousMonth}
          leadsPerDay={mockLeadsCardData.leadsPerDay}
          dailyEvolutionData={mockLeadsCardData.dailyEvolutionData}
          leadsBySource={mockLeadsCardData.leadsBySource}
        />
      </div>

      {/* 2. SalesByFunnelCard - Vendas por Funil */}
      <div className="mb-8">
        <SalesByFunnelCard
          title={mockSalesByFunnelCardData.title}
          period={mockSalesByFunnelCardData.period}
          totalRevenue={mockSalesByFunnelCardData.totalRevenue}
          totalSales={mockSalesByFunnelCardData.totalSales}
          avgTicket={mockSalesByFunnelCardData.avgTicket}
          funnels={mockSalesByFunnelCardData.funnels}
        />
      </div>

      {/* 3. ConversionTimeCard - Tempos no Funil */}
      <div className="mb-8">
        <ConversionTimeCard
          title={mockConversionTimeCardData.title}
          subtitle={mockConversionTimeCardData.subtitle}
          totalTime={mockConversionTimeCardData.totalTime}
          bestChannel={mockConversionTimeCardData.bestChannel}
          improvement={mockConversionTimeCardData.improvement}
          channels={mockConversionTimeCardData.channels}
          monthlyEvolution={mockConversionTimeCardData.monthlyEvolution}
          additionalMetrics={mockConversionTimeCardData.additionalMetrics}
          aiInsight={mockConversionTimeCardData.aiInsight}
        />
      </div>

      {/* 4. NoShowCancellationCard - Faltas e Cancelamentos */}
      <div className="mb-8">
        <NoShowCancellationCard
          title={mockNoShowCancellationCardData.title}
          subtitle={mockNoShowCancellationCardData.subtitle}
          totalCount={mockNoShowCancellationCardData.totalCount}
          percentage={mockNoShowCancellationCardData.percentage}
          revenue={mockNoShowCancellationCardData.revenue}
          change={mockNoShowCancellationCardData.change}
          metrics={mockNoShowCancellationCardData.metrics}
          dayData={mockNoShowCancellationCardData.dayData}
          motives={mockNoShowCancellationCardData.motives}
          recentItems={mockNoShowCancellationCardData.recentItems}
        />
      </div>

      {/* 5. ResponseSpeedCard - Velocidade de Resposta */}
      <div className="mb-8">
        <ResponseSpeedCard
          title={mockResponseSpeedCardData.title}
          subtitle={mockResponseSpeedCardData.subtitle}
          avgResponseTime={mockResponseSpeedCardData.avgResponseTime}
          fastResponsePercentage={mockResponseSpeedCardData.fastResponsePercentage}
          extraRevenue={mockResponseSpeedCardData.extraRevenue}
          timeRangeData={mockResponseSpeedCardData.timeRangeData}
          sdrData={mockResponseSpeedCardData.sdrData}
          speedGoal={mockResponseSpeedCardData.speedGoal}
          speedGoalPercentage={mockResponseSpeedCardData.speedGoalPercentage}
          impactInsight={mockResponseSpeedCardData.impactInsight}
          aiInsight={mockResponseSpeedCardData.aiInsight}
        />
      </div>

      {/* 6. LostLeadsCard - Leads Perdidos */}
      <div className="mb-8">
        <LostLeadsCard
          title={mockLostLeadsCardData.title}
          subtitle={mockLostLeadsCardData.subtitle}
          totalLost={mockLostLeadsCardData.totalLost}
          lostPercentage={mockLostLeadsCardData.lostPercentage}
          lostRevenue={mockLostLeadsCardData.lostRevenue}
          topObjections={mockLostLeadsCardData.topObjections}
          channels={mockLostLeadsCardData.channels}
          aiInsight={mockLostLeadsCardData.aiInsight}
        />
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
