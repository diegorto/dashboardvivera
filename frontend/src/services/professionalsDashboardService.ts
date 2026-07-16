import { AxiosError } from 'axios';
import { api } from './api';

export interface ProfessionalsKPIs {
  totalProfessionals: number;
  totalDeals: number;
  totalWon: number;
  totalRevenue: number;
  avgRevenuePerProfessional: number;
}

export interface ProfessionalRanking {
  id: string | number;
  name: string;
  deals: number;
  won: number;
  lost: number;
  open: number;
  revenue: number;
  conversionRate: number;
  avgTicket: number;
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

export interface FullProfessionalsDashboardData {
  kpis: ProfessionalsKPIs;
  ranking: ProfessionalRanking[];
}

class ProfessionalsDashboardService {
  private baseUrl = '/api/dashboard';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getProfessionalsKPIs(since: string, until: string): Promise<ProfessionalsKPIs> {
    try {
      const response = await api.get<APIResponse<ProfessionalsKPIs>>(
        `/dashboard/professionals/kpis`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar KPIs de profissionais');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar KPIs: ${this.extractError(error)}`);
    }
  }

  async getRanking(since: string, until: string): Promise<ProfessionalRanking[]> {
    try {
      const response = await api.get<APIResponse<ProfessionalRanking[]>>(
        `/dashboard/professionals/ranking`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar ranking');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar ranking: ${this.extractError(error)}`);
    }
  }

  async getFullProfessionalsDashboard(
    since: string,
    until: string
  ): Promise<FullProfessionalsDashboardData> {
    const [kpis, ranking] = await Promise.all([
      this.getProfessionalsKPIs(since, until),
      this.getRanking(since, until)
    ]);
    return { kpis, ranking };
  }
}

export default new ProfessionalsDashboardService();
