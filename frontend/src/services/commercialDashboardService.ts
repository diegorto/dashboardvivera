import axios, { AxiosError } from 'axios';

export interface CommercialKPIs {
  leads: number;
  qualified: number;
  scheduled: number;
  attended: number;
  purchased: number;
}

export interface ProfessionalConversion {
  id: string;
  name: string;
  leads: number;
  qualified: number;
  scheduled: number;
  attended: number;
  purchased: number;
  conversionRate: number;
  avgTicket: number;
  timeToSale: number;
  timeFirstContact: number;
  trend: number;
}

export interface LossReason {
  reason: string;
  quantity: number;
  percentage: number;
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

export interface FullDashboardData {
  kpis: CommercialKPIs;
  conversions: ProfessionalConversion[];
  reasons: LossReason[];
}

class CommercialDashboardService {
  private baseUrl = 'http://localhost:3000/api/dashboard';

  async getCommercialKPIs(since: string, until: string): Promise<CommercialKPIs> {
    try {
      const response = await axios.get<APIResponse<CommercialKPIs>>(
        `${this.baseUrl}/commercial/kpis`,
        { params: { since, until } }
      );

      if (!response.data.success) {
        throw new Error('Erro ao buscar KPIs comerciais');
      }

      return response.data.data;
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.error || error.message
        : error instanceof Error
        ? error.message
        : 'Erro desconhecido';
      throw new Error(`Erro ao buscar KPIs: ${errorMessage}`);
    }
  }

  async getConversionsByProfessional(
    since: string,
    until: string
  ): Promise<ProfessionalConversion[]> {
    try {
      const response = await axios.get<APIResponse<ProfessionalConversion[]>>(
        `${this.baseUrl}/commercial/conversions`,
        { params: { since, until } }
      );

      if (!response.data.success) {
        throw new Error('Erro ao buscar conversões');
      }

      return response.data.data;
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.error || error.message
        : error instanceof Error
        ? error.message
        : 'Erro desconhecido';
      throw new Error(`Erro ao buscar conversões: ${errorMessage}`);
    }
  }

  async getLossReasons(since: string, until: string): Promise<LossReason[]> {
    try {
      const response = await axios.get<APIResponse<LossReason[]>>(
        `${this.baseUrl}/commercial/reasons`,
        { params: { since, until } }
      );

      if (!response.data.success) {
        throw new Error('Erro ao buscar motivos de perda');
      }

      return response.data.data;
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.error || error.message
        : error instanceof Error
        ? error.message
        : 'Erro desconhecido';
      throw new Error(`Erro ao buscar motivos: ${errorMessage}`);
    }
  }

  async getFullCommercialDashboard(
    since: string,
    until: string
  ): Promise<FullDashboardData> {
    try {
      const [kpis, conversions, reasons] = await Promise.all([
        this.getCommercialKPIs(since, until),
        this.getConversionsByProfessional(since, until),
        this.getLossReasons(since, until)
      ]);

      return { kpis, conversions, reasons };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao carregar dashboard comercial: ${errorMessage}`);
    }
  }
}

export default new CommercialDashboardService();
