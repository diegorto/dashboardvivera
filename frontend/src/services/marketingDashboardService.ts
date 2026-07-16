import api from './api';

export interface MarketingKPIs {
  totalInvestment: number;
  totalRevenue: number;
  avgRoas: number;
  totalLeads: number;
  totalImpressions: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'Ativo' | 'Pausado' | 'Encerrado';
  investment: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  messages: number;
  revenue: number;
  roas: number;
  revPerLead: number;
  revPerAppt: number;
  trend: number;
}

export interface TrendDataPoint {
  month: string;
  revenue: number;
  investment: number;
}

export interface DateRange {
  since: string;
  until: string;
}

class MarketingDashboardService {
  /**
   * Busca KPIs resumidos do Marketing
   */
  async getMarketingKPIs(since?: string, until?: string): Promise<MarketingKPIs> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/marketing/kpis?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca lista de campanhas com todas as métricas
   */
  async getCampaigns(since?: string, until?: string): Promise<Campaign[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/marketing/campaigns?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca dados para gráfico de tendência (receita vs investimento)
   */
  async getTrendChart(since?: string, until?: string): Promise<TrendDataPoint[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/marketing/trend?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca todos os dados do Marketing Dashboard de forma paralela com fallback
   */
  async getFullMarketingDashboard(since?: string, until?: string) {
    const results = await Promise.allSettled([
      this.getMarketingKPIs(since, until),
      this.getCampaigns(since, until),
      this.getTrendChart(since, until)
    ]);

    const [kpisResult, campaignsResult, trendResult] = results;

    return {
      kpis: kpisResult.status === 'fulfilled' ? kpisResult.value : {
        totalInvestment: 0,
        totalRevenue: 0,
        avgRoas: 0,
        totalLeads: 0,
        totalImpressions: 0
      },
      campaigns: campaignsResult.status === 'fulfilled' ? campaignsResult.value : [],
      trendChart: trendResult.status === 'fulfilled' ? trendResult.value : []
    };
  }
}

export default new MarketingDashboardService();
