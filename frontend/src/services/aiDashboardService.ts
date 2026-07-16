import { AxiosError } from 'axios';
import { api } from './api';

export type InsightSeverity = 'success' | 'info' | 'warning' | 'critical';
export type InsightTrend = 'up' | 'down' | 'stable';

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  trend: InsightTrend;
  recommendation: string;
  metric: number;
}

export interface AINarrative {
  available: boolean;
  narrative: string | null;
  reason?: string;
  model?: string;
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

export interface FullAIDashboardData {
  insights: AIInsight[];
  narrative: AINarrative;
}

class AIDashboardService {
  private baseUrl = '/api/dashboard';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getInsights(since: string, until: string): Promise<AIInsight[]> {
    try {
      const response = await api.get<APIResponse<AIInsight[]>>(
        `/dashboard/ai/insights`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar insights');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar insights: ${this.extractError(error)}`);
    }
  }

  async getNarrative(since: string, until: string): Promise<AINarrative> {
    try {
      const response = await api.get<APIResponse<AINarrative>>(
        `/dashboard/ai/narrative`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar narrativa');
      return response.data.data;
    } catch (error) {
      // Narrativa é opcional: falha aqui não deve derrubar o dashboard
      return { available: false, narrative: null, reason: this.extractError(error) };
    }
  }

  async getFullAIDashboard(since: string, until: string): Promise<FullAIDashboardData> {
    const [insights, narrative] = await Promise.all([
      this.getInsights(since, until),
      this.getNarrative(since, until)
    ]);
    return { insights, narrative };
  }
}

export default new AIDashboardService();
