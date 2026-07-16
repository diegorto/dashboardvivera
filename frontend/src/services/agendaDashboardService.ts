import { AxiosError } from 'axios';
import { api } from './api';

export interface AgendaKPIs {
  today: number;
  tomorrow: number;
  week: number;
  doneToday: number;
  completionRate: number;
  noShow: number;
}

export interface Appointment {
  id: number;
  subject: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  done: boolean;
  professional: string;
  patient: string;
  dealTitle: string;
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

export interface FullAgendaDashboardData {
  kpis: AgendaKPIs;
  appointments: Appointment[];
}

class AgendaDashboardService {
  private baseUrl = '/api/dashboard';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getAgendaKPIs(): Promise<AgendaKPIs> {
    try {
      const response = await api.get<APIResponse<AgendaKPIs>>(`/dashboard/agenda/kpis`);
      if (!response.data.success) throw new Error('Erro ao buscar KPIs da agenda');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar KPIs: ${this.extractError(error)}`);
    }
  }

  async getAppointments(since?: string, until?: string): Promise<Appointment[]> {
    try {
      const response = await api.get<APIResponse<Appointment[]>>(
        `/dashboard/agenda/appointments`,
        { params: since && until ? { since, until } : {} }
      );
      if (!response.data.success) throw new Error('Erro ao buscar compromissos');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar compromissos: ${this.extractError(error)}`);
    }
  }

  async getFullAgendaDashboard(since?: string, until?: string): Promise<FullAgendaDashboardData> {
    const [kpis, appointments] = await Promise.all([
      this.getAgendaKPIs(),
      this.getAppointments(since, until)
    ]);
    return { kpis, appointments };
  }
}

export default new AgendaDashboardService();
