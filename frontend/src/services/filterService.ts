import axios from 'axios';

export interface FilterOptions {
  procedures: string[];
  professionals: string[];
  sdrs: string[];
  campaigns: string[];
  adSets: string[];
  pipelines: string[];
  statuses: string[];
}

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
});

export const filterService = {
  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const response = await api.get('/api/filters/options');
      return response.data;
    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error);
      // Retorna valores padrão se falhar
      return {
        procedures: ['Limpeza', 'Restauração', 'Implante', 'Ortodontia'],
        professionals: ['Dr. João', 'Dr. Maria', 'Dra. Silva', 'Dr. Costa'],
        sdrs: ['Agda', 'Helenice'],
        campaigns: ['Google Ads', 'Meta Ads', 'YouTube'],
        adSets: ['Conjunto 1', 'Conjunto 2', 'Conjunto 3'],
        pipelines: ['Inbound', 'Outbound', 'Referência'],
        statuses: ['Aberto', 'Em negociação', 'Ganha', 'Perdida'],
      };
    }
  },
};

export default filterService;
