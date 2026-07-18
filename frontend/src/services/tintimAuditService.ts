import axios from 'axios';

export interface TintimLead {
  leadId: string;
  name: string;
  phone: string;
  source?: string;
  campaign?: string;
  missingFields?: string[];
}

export interface TintimAuditResponse {
  totalDeals: number;
  missingTraffic: number;
  scanned: number;
  diagnosed: number;
  leads: TintimLead[];
}

const tintimAuditService = {
  async getAudit(): Promise<TintimAuditResponse> {
    try {
      const response = await axios.get('/api/tintim/audit');
      return response.data;
    } catch (error) {
      console.error('Erro ao carregar auditoria Tintim:', error);
      return {
        totalDeals: 0,
        missingTraffic: 0,
        scanned: 0,
        diagnosed: 0,
        leads: []
      };
    }
  },

  async fixLead(leadId: string): Promise<boolean> {
    try {
      await axios.post('/api/tintim/audit/fix', { leadId });
      return true;
    } catch (error) {
      console.error('Erro ao corrigir lead:', error);
      return false;
    }
  }
};

export default tintimAuditService;
