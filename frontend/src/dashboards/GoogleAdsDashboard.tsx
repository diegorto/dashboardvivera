import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
}

const GoogleAdsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [totalStats, setTotalStats] = useState({
    impressions: 0,
    clicks: 0,
    cost: 0,
    conversions: 0,
    revenue: 0,
    ctr: 0,
    cpc: 0,
    roas: 0
  });

  useEffect(() => {
    loadData();
  }, [filters.period, filters.dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      const dateRange = getDateRange(filters.period, filters.dateRange);
      const dateRangeParam = 'LAST_30_DAYS'; // Mapeamos período para enum do Google Ads

      const [campaignsRes, metricsRes, conversionsRes] = await Promise.allSettled([
        axios.get('/api/google-ads/campaigns'),
        axios.get('/api/google-ads/metrics', {
          params: { date_range: dateRangeParam }
        }),
        axios.get('/api/google-ads/conversions', {
          params: { date_range: dateRangeParam }
        })
      ]);

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.data.success) {
        setCampaigns(campaignsRes.value.data.data || []);
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.data.success) {
        const metricsData = metricsRes.value.data.data || [];
        setMetrics(metricsData);

        // Calcular totais
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

        setTotalStats({
          ...totals,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
          roas: totals.cost > 0 ? totals.revenue / totals.cost : 0
        });
      }

      if (conversionsRes.status === 'fulfilled' && conversionsRes.value.data.success) {
        setConversions(conversionsRes.value.data.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
      addNotification('error', `Erro: ${message}`);
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
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-1">Impressões</div>
          <div className="text-[18px] font-bold text-[#0f172a]">{formatNumber(totalStats.impressions)}</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-1">Cliques</div>
          <div className="text-[18px] font-bold text-[#0f172a]">{formatNumber(totalStats.clicks)}</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-1">Gasto</div>
          <div className="text-[18px] font-bold text-[#ef4444]">{formatCurrency(totalStats.cost)}</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-1">Conversões</div>
          <div className="text-[18px] font-bold text-[#10b981]">{formatNumber(totalStats.conversions)}</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-1">CTR</div>
          <div className="text-[18px] font-bold text-[#0f172a]">{totalStats.ctr.toFixed(2)}%</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-[11px] text-[#64748b] font-semibold uppercase mb-1">CPC</div>
          <div className="text-[18px] font-bold text-[#0f172a]">{formatCurrency(totalStats.cpc)}</div>
        </div>
      </div>

      {/* Campanhas Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 mb-6">
        <h3 className="text-[13px] font-semibold text-[#0f172a] mb-4">Campanhas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[#e2e8f0]">
                <th className="text-left py-2 px-3 font-semibold text-[#64748b]">Campanha</th>
                <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Status</th>
                <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Budget</th>
                <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Impressões</th>
                <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Cliques</th>
                <th className="text-right py-2 px-3 font-semibold text-[#64748b]">Gasto</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-[#f1f5f9]">
                  <td className="py-3 px-3 text-[#0f172a] font-medium">{campaign.name}</td>
                  <td className="text-right py-3 px-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      campaign.status === 'ENABLED' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'
                    }`}>
                      {campaign.status === 'ENABLED' ? 'Ativa' : 'Pausada'}
                    </span>
                  </td>
                  <td className="text-right py-3 px-3 text-[#0f172a]">{formatCurrency(campaign.budget || 0)}</td>
                  <td className="text-right py-3 px-3 text-[#0f172a]">{formatNumber(campaign.impressions || 0)}</td>
                  <td className="text-right py-3 px-3 text-[#0f172a]">{formatNumber(campaign.clicks || 0)}</td>
                  <td className="text-right py-3 px-3 text-[#0f172a] font-semibold">{formatCurrency(campaign.cost || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.length === 0 && (
          <div className="text-center py-8 text-[#94a3b8]">
            Nenhuma campanha encontrada. Verifique se sua conta Google Ads está conectada.
          </div>
        )}
      </div>

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
              <Bar dataKey="impressions" fill="#6366f1" />
              <Bar dataKey="clicks" fill="#8b5cf6" />
              <Bar dataKey="conversions" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Layout>
  );
};

export default GoogleAdsDashboard;
