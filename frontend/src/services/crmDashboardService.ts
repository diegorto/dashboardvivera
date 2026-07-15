import axios, { AxiosError } from 'axios';

export interface CRMKPIs {
  openDeals: number;
  pipelineValue: number;
  avgStageTime: number;
  lostDeals: number;
  recoverable: number;
  wonDeals: number;
}

export interface PipelineDeal {
  id: number;
  title: string;
  value: number;
  personName: string;
  daysInStage: number;
  origem: string;
  campanha: string;
}

export interface PipelineStage {
  stageId: number;
  stageName: string;
  count: number;
  value: number;
  avgDays: number;
  deals: PipelineDeal[];
}

export interface RecoveryOpportunity {
  id: number;
  title: string;
  personName: string;
  value: number;
  lostReason: string;
  lostDate: string;
  origem: string;
  campanha: string;
  email: string;
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

export interface FullCRMDashboardData {
  kpis: CRMKPIs;
  pipeline: PipelineStage[];
  recovery: RecoveryOpportunity[];
}

class CRMDashboardService {
  private baseUrl = 'http://localhost:3000/api/dashboard';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getCRMKPIs(since: string, until: string): Promise<CRMKPIs> {
    try {
      const response = await axios.get<APIResponse<CRMKPIs>>(
        `${this.baseUrl}/crm/kpis`,
        { params: { since, until } }
      );

      if (!response.data.success) {
        throw new Error('Erro ao buscar KPIs do CRM');
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar KPIs: ${this.extractError(error)}`);
    }
  }

  async getPipeline(since: string, until: string): Promise<PipelineStage[]> {
    try {
      const response = await axios.get<APIResponse<PipelineStage[]>>(
        `${this.baseUrl}/crm/pipeline`,
        { params: { since, until } }
      );

      if (!response.data.success) {
        throw new Error('Erro ao buscar pipeline');
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar pipeline: ${this.extractError(error)}`);
    }
  }

  async getRecoveryOpportunities(since: string, until: string): Promise<RecoveryOpportunity[]> {
    try {
      const response = await axios.get<APIResponse<RecoveryOpportunity[]>>(
        `${this.baseUrl}/crm/recovery`,
        { params: { since, until } }
      );

      if (!response.data.success) {
        throw new Error('Erro ao buscar oportunidades de recuperação');
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar recuperação: ${this.extractError(error)}`);
    }
  }

  async getFullCRMDashboard(since: string, until: string): Promise<FullCRMDashboardData> {
    try {
      const [kpis, pipeline, recovery] = await Promise.all([
        this.getCRMKPIs(since, until),
        this.getPipeline(since, until),
        this.getRecoveryOpportunities(since, until)
      ]);

      return { kpis, pipeline, recovery };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao carregar dashboard CRM: ${errorMessage}`);
    }
  }
}

export default new CRMDashboardService();
