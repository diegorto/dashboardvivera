import axios from 'axios';

export interface TintimLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastInteraction: string;
  source: string;
  status: string;
}

export interface TintimAuditData {
  totalLeads: number;
  leadsWithoutPaidTraffic: number;
  leadsWithPaidTraffic: number;
  leads: TintimLead[];
}

const api = axios.create({
  baseURL: '/api',
});

export const tintimAuditService = {
  async getAudit(since?: string, until?: string): Promise<TintimAuditData> {
    try {
      const params = new URLSearchParams();
      if (since) params.append('since', since);
      if (until) params.append('until', until);

      const response = await api.get(`/tintim/audit?${params.toString()}`);
      if (response.data.success) {
        return response.data.data;
      }
      return {
        totalLeads: 0,
        leadsWithoutPaidTraffic: 0,
        leadsWithPaidTraffic: 0,
        leads: []
      };
    } catch (error) {
      console.error('Erro ao carregar auditoria Tintim:', error);
      return {
        totalLeads: 0,
        leadsWithoutPaidTraffic: 0,
        leadsWithPaidTraffic: 0,
        leads: []
      };
    }
  }
};

export default tintimAuditService;
