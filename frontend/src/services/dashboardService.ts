import api from './api';

export interface KPIValue {
  value: string | number;
  change?: number;
  sub?: string;
}

export interface ExecutiveKPIs {
  revenue: KPIValue;
  goal: KPIValue;
  goalPct: KPIValue;
  forecast: KPIValue;
  roi: KPIValue;
  roas: KPIValue;
  cac: KPIValue;
  avgTicket: KPIValue;
  appointmentsToday: KPIValue;
  appointmentsTomorrow: KPIValue;
  attendance: KPIValue;
  noShow: KPIValue;
  leads: KPIValue;
  qualified: KPIValue;
  sales: KPIValue;
}

export interface ChartDataPoint {
  month: string;
  revenue: number;
  goal: number;
  forecast: number;
}

export interface FunnelStage {
  stage: string;
  value: number;
  pct: number;
}

export interface AgendaData {
  today: { scheduled: number; attended: number; noShow: number };
  tomorrow: { scheduled: number; attended: number; noShow: number };
}

export interface Alert {
  type: 'warning' | 'critical' | 'info' | 'success';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AIInsight {
  title: string;
  description: string;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
}

export interface DateRange {
  since: string;
  until: string;
}

class DashboardService {
  /**
   * Busca todos os KPIs do Executive Dashboard
   */
  async getExecutiveKPIs(
    since?: string,
    until?: string,
    prevSince?: string,
    prevUntil?: string
  ): Promise<ExecutiveKPIs> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);
    if (prevSince) params.append('prevSince', prevSince);
    if (prevUntil) params.append('prevUntil', prevUntil);

    const response = await api.get(`/dashboard/executive?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca dados para gráfico de Receita vs Meta vs Forecast
   */
  async getRevenueChart(since?: string, until?: string): Promise<ChartDataPoint[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/revenue?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca dados do funil executivo
   */
  async getFunnel(since?: string, until?: string): Promise<FunnelStage[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/funnel?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca dados de agenda (hoje e amanhã)
   */
  async getAgenda(): Promise<AgendaData> {
    const response = await api.get('/dashboard/agenda');
    return response.data.data;
  }

  /**
   * Busca alertas contextuais
   */
  async getAlerts(since?: string, until?: string): Promise<Alert[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/alerts?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca insights gerados por IA
   */
  async getAISummary(since?: string, until?: string): Promise<AIInsight[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);

    const response = await api.get(`/dashboard/ai-summary?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Busca todos os dados do Executive Dashboard de forma paralela
   * Útil para carregar tudo de uma vez com melhor performance
   */
  async getFullExecutiveDashboard(since?: string, until?: string, prevSince?: string, prevUntil?: string) {
    const [kpis, revenueChart, funnel, agenda, alerts, aiSummary] = await Promise.all([
      this.getExecutiveKPIs(since, until, prevSince, prevUntil),
      this.getRevenueChart(since, until),
      this.getFunnel(since, until),
      this.getAgenda(),
      this.getAlerts(since, until),
      this.getAISummary(since, until)
    ]);

    return {
      kpis,
      revenueChart,
      funnel,
      agenda,
      alerts,
      aiSummary
    };
  }
}

export default new DashboardService();
