import axios, { AxiosError } from 'axios';
import { api } from './api';

export interface AppSettings {
  pipedriveToken: string;
  fbAccessToken: string;
  fbAdAccountIds: string;
  tintimAccountCode: string;
  tintimAccountToken: string;
  googleAdsCustomerId: string;
  googleAdsDeveloperToken: string;
  openaiApiKey: string;
  inboundPipelineId: number;
  monthlyGoal: number;
  configured: {
    pipedrive: boolean;
    meta: boolean;
    tintim: boolean;
    googleAds: boolean;
    openai: boolean;
  };
}

export interface ConnectionTestResult {
  pipedrive: { ok: boolean; message: string };
  meta: { ok: boolean; message: string };
  tintim: { ok: boolean; message: string };
  googleAds: { ok: boolean; message: string };
  openai: { ok: boolean; message: string };
}

class SettingsService {
  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.error || error.message;
    }
    return error instanceof Error ? error.message : 'Erro desconhecido';
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const response = await api.get<{ success: boolean; data: AppSettings }>(
        '/settings'
      );
      if (!response.data.success) throw new Error('Erro ao buscar configurações');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao buscar configurações: ${this.extractError(error)}`);
    }
  }

  async saveSettings(settings: Partial<Omit<AppSettings, 'configured'>>): Promise<string> {
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        '/settings',
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
      const response = await api.post<{ success: boolean; data: ConnectionTestResult }>(
        '/settings/test'
      );
      if (!response.data.success) throw new Error('Erro ao testar conexões');
      return response.data.data;
    } catch (error) {
      throw new Error(`Erro ao testar: ${this.extractError(error)}`);
    }
  }
}

export default new SettingsService();
