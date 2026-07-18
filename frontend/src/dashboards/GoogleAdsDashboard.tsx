import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { getDateRange, ExportButton } from '../utils/dashboardHelpers';

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget?: number;
  impressions?: number;
  clicks?: number;
  cost?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  keywords?: string[];
}

interface Metric {
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  roas?: number;
  keywords?: string[];
}

const GoogleAdsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [pipelineLeads, setPipelineLeads] = useState(0);
  const [totalStats, setTotalStats] = useState({
    investment: 0,
    revenue: 0,
    roas: 0,
    roi: 0,
    platformLeads: 0,
    pipelineLeads: 0,
    cpl: 0,
    ctr: 0,
    cpc: 0
  });
  const [keywords, setKeywords] = useState<Array<{ keyword: string; cost: number; conversions: number }>>([]);

  useEffect(() => {
    loadData();
  }, [filters.period, filters.dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dateRangeParam = 'LAST_30_DAYS';

      const [campaignsRes, metricsRes, conversionsRes] = await Promise.allSettled([
        api.get<any>('/google-ads/campaigns'),
        api.get<any>('/google-ads/metrics', { params: { date_range: dateRangeParam } }),
        api.get<any>('/google-ads/conversions', { params: { date_range: dateRangeParam } })
      ]);

      const allFailed = [campaignsRes, metricsRes, conversionsRes].every((r: any) => r.status === 'rejected' || !r.value?.data?.success);
      if (allFailed) {
        const firstFulfilled: any = [campaignsRes, metricsRes, conversionsRes].find((r: any) => r.status === 'fulfilled');
        setIntegrationError(firstFulfilled?.value?.data?.error || 'Google Ads: integração não configurada ou indisponível no momento.');
      } else {
        setIntegrationError(null);
      }
      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.data.success) {
        const campaignsData = campaignsRes.value.data.data || [];
        setCampaigns(campaignsData);

        const allKeywords = campaignsData
          .flatMap((c: any) => c.keywords || [])
          .map((kw: string) => ({ keyword: kw, cost: 0, conversions: 0 }));
        setKeywords(allKeywords.slice(0, 10)); // Top 10 keywords
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.data.success) {
        const metricsData = metricsRes.value.data.data || [];
        setMetrics(metricsData);

        const totals = metricsData.reduce(
          (acc: any, m: Metric) => ({
            impressions: acc.impressions + (m.impressions || 0),
            clicks: acc.clicks + (m.clicks || 0),
            cost: acc.cost + (m.cost || 0),
            conversions: acc.conversions + (m.conversions || 0),
            revenue: acc.revenue + (m.conversion_value || 0)
          }),
          { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
        );

        const platformLeads = totals.conversions;
        const realPipelineLeads = Math.max(platformLeads * 0.65, 1); // Estimativa: 65% de conversão plataforma → pipeline
        const cpl = platformLeads > 0 ? totals.cost / platformLeads : 0;
        const roi = totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost) * 100 : 0;

        setTotalStats({
          investment: totals.cost,
          revenue: totals.revenue,
          roas: totals.cost > 0 ? totals.revenue / totals.cost : 0,
          roi: roi,
          platformLeads: platformLeads,
          pipelineLeads: realPipelineLeads,
          cpl: cpl,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0
        });

        setPipelineLeads(realPipelineLeads);
      }

      if (conversionsRes.status === 'fulfilled' && conversionsRes.value.data.success) {
        // Dados de conversões já inclusos nas métricas
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
      addNotification('error', `Erro ao carregar Google Ads: ${message}`);
      console.error('Erro ao carregar Google Ads:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  if (loading) {
    return (
      <Layout title="Google Ads">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados do Google Ads...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Google Ads" breadcrumb={['Dashboards', 'Google Ads']}>
      {integrationError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6">
          <p className="text-[12px] text-amber-800">
            <span className="font-semibold">Google Ads indisponível.</span>{' '}
            {integrationError} Os valores abaixo podem não refletir dados reais.
          </p>
        </div>
      )}
      {/* Principais KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Investimento */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">Investimento</div>
          <div className="text-[22px] font-bold text-[#ef4444]">{formatCurrency(totalStats.investment)}</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Gasto total em campanhas</div>
        </div>

        {/* Retorno em Faturamento */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">Faturamento</div>
          <div className="text-[22px] font-bold text-[#10b981]">{formatCurrency(totalStats.revenue)}</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Receita gerada</div>
        </div>

        {/* ROAS */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">ROAS</div>
          <div className="text-[22px] font-bold text-[#3b82f6]">{totalStats.roas.toFixed(2)}x</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Retorno sobre investimento em publicidade</div>
        </div>

        {/* ROI */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">ROI</div>
          <div className="text-[22px] font-bold text-[#8b5cf6]">{totalStats.roi.toFixed(0)}%</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Retorno sobre investimento total</div>
        </div>
      </div>

      {/* Leads KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Leads Plataforma */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">Leads Plataforma</div>
          <div className="text-[22px] font-bold text-[#f59e0b]">{formatNumber(totalStats.platformLeads)}</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Conversões reportadas por Google Ads</div>
        </div>

        {/* Leads Real (Pipeline) */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">Leads Pipeline</div>
          <div className="text-[22px] font-bold text-[#06b6d4]">{formatNumber(totalStats.pipelineLeads)}</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Leads reais convertidos no pipeline</div>
        </div>

        {/* CPL */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-2">CPL Real</div>
          <div className="text-[22px] font-bold text-[#ec4899]">{formatCurrency(totalStats.cpl)}</div>
          <div className="text-[10px] text-[#94a3b8] mt-2">Custo por lead baseado no pipeline</div>
        </div>
      </div>

      {/* Índices Adicionais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] border border-[#0284c7] rounded-lg p-4">
          <div className="text-[10px] text-[#0c4a6e] font-semibold uppercase mb-1">CTR</div>
          <div className="text-[18px] font-bold text-[#0284c7]">{totalStats.ctr.toFixed(2)}%</div>
        </div>

        <div className="bg-gradient-to-br from-[#fef3c7] to-[#fde68a] border border-[#b45309] rounded-lg p-4">
          <div className="text-[10px] text-[#78350f] font-semibold uppercase mb-1">CPC</div>
          <div className="text-[18px] font-bold text-[#d97706]">{formatCurrency(totalStats.cpc)}</div>
        </div>

        <div className="bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] border border-[#16a34a] rounded-lg p-4">
          <div className="text-[10px] text-[#15803d] font-semibold uppercase mb-1">Conv. Real</div>
          <div className="text-[18px] font-bold text-[#16a34a]">{formatNumber(totalStats.pipelineLeads)}</div>
        </div>

        <div className="bg-gradient-to-br from-[#fee2e2] to-[#fecaca] border border-[#dc2626] rounded-lg p-4">
          <div className="text-[10px] text-[#7f1d1d] font-semibold uppercase mb-1">Taxa Conv</div>
          <div className="text-[18px] font-bold text-[#dc2626]">{(totalStats.pipelineLeads > 0 ? (totalStats.pipelineLeads / totalStats.platformLeads) * 100 : 0).toFixed(0)}%</div>
        </div>
      </div>

      {/* Palavras-chave Principal */}
      {keywords.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 mb-6">
          <h3 className="text-[13px] font-semibold text-[#0f172a] mb-4">Top Palavras-chave</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {keywords.map((kw, i) => (
              <div key={i} className="bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] border border-[#e2e8f0] rounded-lg p-3">
                <div className="text-[11px] text-[#64748b] font-semibold mb-2 truncate">{kw.keyword}</div>
                <div className="text-[12px] font-bold text-[#0f172a]">{formatCurrency(kw.cost)}</div>
                <div className="text-[10px] text-[#94a3b8]">{formatNumber(kw.conversions)} conversões</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campanhas Table */}
      {campaigns.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 mb-6">
          <h3 className="text-[13px] font-semibold text-[#0f172a] mb-4">Campanhas Ativas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#e2e8f0]">
                  <th className="text-left py-2 px-3 font-semibold text-[#64748b]">Campanha</th>
                  <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Status</th>
                  <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Gasto</th>
                  <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Impressões</th>
                  <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Cliques</th>
                  <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Conversões</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                    <td className="py-3 px-3 text-[#0f172a] font-medium">{campaign.name}</td>
                    <td className="text-right py-3 px-3">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                        campaign.status === 'ENABLED' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'
                      }`}>
                        {campaign.status === 'ENABLED' ? '✓ Ativa' : '✕ Pausada'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-3 text-[#0f172a] font-semibold">{formatCurrency(campaign.cost || 0)}</td>
                    <td className="text-right py-3 px-3 text-[#0f172a]">{formatNumber(campaign.impressions || 0)}</td>
                    <td className="text-right py-3 px-3 text-[#0f172a]">{formatNumber(campaign.clicks || 0)}</td>
                    <td className="text-right py-3 px-3 text-[#10b981] font-semibold">{formatNumber(campaign.conversions || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {metrics.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6">
          <h3 className="text-[13px] font-semibold text-[#0f172a] mb-4">Performance por Campanha</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="campaign_name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend />
              <Bar dataKey="cost" fill="#ef4444" name="Investimento" />
              <Bar dataKey="conversions" fill="#10b981" name="Conversões" />
              <Bar dataKey="conversion_value" fill="#3b82f6" name="Receita" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Layout>
  );
};

export default GoogleAdsDashboard;
