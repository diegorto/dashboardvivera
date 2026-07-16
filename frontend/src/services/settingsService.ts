import axios, { AxiosError } from 'axios';

export interface AppSettings {
  pipedriveToken: string;
  fbAccessToken: string;
  fbAdAccountIds: string;
  tintimApiKey: string;
  tintimWorkspaceId: string;
  openaiApiKey: string;
  inboundPipelineId: number;
  monthlyGoal: number;
  configured: {
    pipedrive: boolean;
    meta: boolean;
    tintim: boolean;
    openai: boolean;
  };
}

export interface ConnectionTestResult {
  pipedrive: { ok: boolean; message: string };
  meta: { ok: boolean; message: string };
  tintim: { ok: boolean; message: string };
  openai: { ok: boolean; message: string };
}

class SettingsService {
  private baseUrl = '/api';

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const response = await axios.get<{ success: boolean; data: AppSettings }>(
        `${this.baseUrl}/settings`
      );
      if (!response.data.success) throw new Error('Erro ao buscar configurações');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar configurações: ${this.extractError(error)}`);
    }
  }

  async saveSettings(settings: Partial<Omit<AppSettings, 'configured'>>): Promise<string> {
    try {
      const response = await axios.post<{ success: boolean; message: string }>(
        `${this.baseUrl}/settings`,
        settings
      );
      if (!response.data.success) throw new Error('Erro ao salvar configurações');
      return response.data.message;
    } catch (error) {
      throw new Error(`Erro ao salvar: ${this.extractError(error)}`);
    }
  }

  async testConnections(): Promise<ConnectionTestResult> {
    try {
      const response = await axios.post<{ success: boolean; data: ConnectionTestResult }>(
        `${this.baseUrl}/settings/test`
      );
      if (!response.data.success) throw new Error('Erro ao testar conexões');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao testar: ${this.extractError(error)}`);
    }
  }
}

export default new SettingsService();
