import { AxiosError } from 'axios';
import { api } from './api';

export interface FinancialKPIs {
  revenue: number;
  adSpend: number;
  grossProfit: number;
  margin: number;
  avgTicket: number;
  salesCount: number;
}

export interface MonthlyFinancialData {
  month: string;
  revenue: number;
  investment: number;
  profit: number;
}

export interface DateRange {
  since: string;
  until: string;
}

export interface APIResponse<T> {
  success: boolean;
  range: DateRange;
  data: T;
}

export interface FullFinancialDashboardData {
  kpis: FinancialKPIs;
  monthly: MonthlyFinancialData[];
}

class FinancialDashboardService {
  private baseUrl = '/api/dashboard';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getFinancialKPIs(since: string, until: string): Promise<FinancialKPIs> {
    try {
      const response = await api.get<APIResponse<FinancialKPIs>>(
        `/dashboard/financial/kpis`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar KPIs financeiros');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar KPIs: ${this.extractError(error)}`);
    }
  }

  async getMonthlyData(since: string, until: string): Promise<MonthlyFinancialData[]> {
    try {
      const response = await api.get<APIResponse<MonthlyFinancialData[]>>(
        `/dashboard/financial/monthly`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar dados mensais');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar dados mensais: ${this.extractError(error)}`);
    }
  }

  async getFullFinancialDashboard(
    since: string,
    until: string
  ): Promise<FullFinancialDashboardData> {
    const [kpis, monthly] = await Promise.all([
      this.getFinancialKPIs(since, until),
      this.getMonthlyData(since, until)
    ]);
    return { kpis, monthly };
  }
}

export default new FinancialDashboardService();
