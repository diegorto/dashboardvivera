import axios from 'axios';
import { ApiResponse, PaginatedResponse } from '../types';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token se necessário
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratamento de erros
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Executive Dashboard APIs
export const executiveAPI = {
  getKPIs: async (period: 'day' | 'week' | 'month' | 'year') => {
    const response = await apiClient.get<ApiResponse<any>>(`/executive/kpis`, {
      params: { period },
    });
    return response.data;
  },

  getChartData: async (type: 'revenue' | 'funnel' | 'origin' | 'procedure', period: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/executive/charts/${type}`, {
      params: { period },
    });
    return response.data;
  },

  getAlerts: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/executive/alerts`);
    return response.data;
  },

  getAIInsights: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/executive/ai-insights`);
    return response.data;
  },
};

// Marketing APIs
export const marketingAPI = {
  getCampaigns: async (page = 1, limit = 10) => {
    const response = await apiClient.get<PaginatedResponse<any>>(`/marketing/campaigns`, {
      params: { page, limit },
    });
    return response.data;
  },

  getCreatives: async (campaignId?: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/marketing/creatives`, {
      params: { campaignId },
    });
    return response.data;
  },

  getPerformance: async (period: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/marketing/performance`, {
      params: { period },
    });
    return response.data;
  },
};

// Commercial APIs
export const commercialAPI = {
  getConversionData: async (period: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/commercial/conversion`, {
      params: { period },
    });
    return response.data;
  },

  getSDRPerformance: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/commercial/sdr-performance`);
    return response.data;
  },

  getObjections: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/commercial/objections`);
    return response.data;
  },
};

// CRM APIs
export const crmAPI = {
  getPipeline: async (filters?: any) => {
    const response = await apiClient.get<ApiResponse<any>>(`/crm/pipeline`, {
      params: filters,
    });
    return response.data;
  },

  getOpportunities: async (status: 'open' | 'bottleneck' | 'at-risk') => {
    const response = await apiClient.get<ApiResponse<any>>(`/crm/opportunities`, {
      params: { status },
    });
    return response.data;
  },

  getJourney: async (patientId: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/crm/patient/${patientId}/journey`);
    return response.data;
  },
};

// Patient APIs
export const patientAPI = {
  getPatients: async (page = 1, limit = 10, filters?: any) => {
    const response = await apiClient.get<PaginatedResponse<any>>(`/patients`, {
      params: { page, limit, ...filters },
    });
    return response.data;
  },

  getPatient: async (id: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/patients/${id}`);
    return response.data;
  },

  getPatientTimeline: async (id: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/patients/${id}/timeline`);
    return response.data;
  },
};

// WhatsApp APIs
export const whatsappAPI = {
  getAnalytics: async (period: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/whatsapp/analytics`, {
      params: { period },
    });
    return response.data;
  },

  getMessages: async (page = 1, limit = 10) => {
    const response = await apiClient.get<PaginatedResponse<any>>(`/whatsapp/messages`, {
      params: { page, limit },
    });
    return response.data;
  },
};

// Professional APIs
export const professionalAPI = {
  getProfessionals: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/professionals`);
    return response.data;
  },

  getProfessionalDetails: async (id: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/professionals/${id}`);
    return response.data;
  },

  getSchedule: async (id: string, date: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/professionals/${id}/schedule`, {
      params: { date },
    });
    return response.data;
  },
};

// Financial APIs
export const financialAPI = {
  getMetrics: async (period: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/financial/metrics`, {
      params: { period },
    });
    return response.data;
  },

  getRevenueBySources: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/financial/revenue-sources`);
    return response.data;
  },
};

// Governance APIs
export const governanceAPI = {
  getAuditKPIs: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/audit/kpis`);
    return response.data;
  },

  getAuditStats: async (days: number = 30) => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/audit/stats`, {
      params: { days },
    });
    return response.data;
  },

  getPatientJourney: async (patientId: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/patient-journey/${patientId}`);
    return response.data;
  },

  listPatientsByStage: async (stage: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/patient-journey/stage/${stage}`);
    return response.data;
  },

  getHighPriorityPatients: async (limit: number = 10) => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/patient-journey/priority-high`, {
      params: { limit },
    });
    return response.data;
  },

  getUnresolvedConflicts: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/conflicts/unresolved`);
    return response.data;
  },

  resolveConflict: async (conflictId: string, resolutionValue: string) => {
    const response = await apiClient.post<ApiResponse<any>>(`/governance/conflicts/${conflictId}/resolve`, {
      resolutionValue,
    });
    return response.data;
  },

  getPendingApprovals: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/approvals/pending`);
    return response.data;
  },

  approveItem: async (approvalId: string, userId: string) => {
    const response = await apiClient.post<ApiResponse<any>>(`/governance/approvals/${approvalId}/approve`, {
      userId,
    });
    return response.data;
  },

  rejectItem: async (approvalId: string, userId: string) => {
    const response = await apiClient.post<ApiResponse<any>>(`/governance/approvals/${approvalId}/reject`, {
      userId,
    });
    return response.data;
  },

  getHealth: async () => {
    const response = await apiClient.get<ApiResponse<any>>(`/governance/health`);
    return response.data;
  },
};

// Cliente HTTP generico (usado pelos services de dashboard)
export const api = apiClient;

// Export all APIs
export default {
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  executive: executiveAPI,
  marketing: marketingAPI,
  commercial: commercialAPI,
  crm: crmAPI,
  patient: patientAPI,
  whatsapp: whatsappAPI,
  professional: professionalAPI,
  financial: financialAPI,
  governance: governanceAPI,
};
