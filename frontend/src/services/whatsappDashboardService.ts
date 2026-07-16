import { AxiosError } from 'axios';
import { api } from './api';

export interface WhatsAppKPIs {
  messagesSent: number;
  messagesReceived: number;
  calls: number;
  missedCalls: number;
  avgFirstResponseTime: number;
  avgResponseTime: number;
  conversionRate: number;
}

export interface AttendantRanking {
  id: string | number;
  name: string;
  totalActivities: number;
  calls: number;
  done: number;
  completionRate: number;
  messages: number;
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

export interface FullWhatsAppDashboardData {
  kpis: WhatsAppKPIs;
  ranking: AttendantRanking[];
}

class WhatsAppDashboardService {
  private baseUrl = '/api/dashboard';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getWhatsAppKPIs(since: string, until: string): Promise<WhatsAppKPIs> {
    try {
      const response = await api.get<APIResponse<WhatsAppKPIs>>(
        `/dashboard/whatsapp/kpis`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar KPIs do WhatsApp');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar KPIs: ${this.extractError(error)}`);
    }
  }

  async getRanking(since: string, until: string): Promise<AttendantRanking[]> {
    try {
      const response = await api.get<APIResponse<AttendantRanking[]>>(
        `/dashboard/whatsapp/ranking`,
        { params: { since, until } }
      );
      if (!response.data.success) throw new Error('Erro ao buscar ranking');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar ranking: ${this.extractError(error)}`);
    }
  }

  async getFullWhatsAppDashboard(
    since: string,
    until: string
  ): Promise<FullWhatsAppDashboardData> {
    const [kpis, ranking] = await Promise.all([
      this.getWhatsAppKPIs(since, until),
      this.getRanking(since, until)
    ]);
    return { kpis, ranking };
  }
}

export default new WhatsAppDashboardService();
