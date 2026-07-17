import { useEffect, useState } from 'react';
import { api } from './api';

// Interfaces
export interface LeadsCardData {
  title: string;
  period: string;
  totalLeads: number;
  qualifiedLeads: number;
  qualificationRate: number;
  changeVsPreviousMonth: number;
  leadsPerDay: number;
  dailyEvolutionData: Array<{ date: string; total: number; qualified: number }>;
  leadsBySource: Array<{
    source: string;
    leads: number;
    percentage: number;
    qualified: number;
    qualificationRate: number;
    color: string;
  }>;
}

export interface SalesByFunnelData {
  title: string;
  period: string;
  totalRevenue: number;
  totalSales: number;
  avgTicket: number;
  funnels: Array<{
    name: string;
    color: string;
    revenue: number;
    revenuePercentage: number;
    sales: number;
    avgTicket: number;
    change: number;
    leads: number;
    qualified: number;
    conversionRate: number;
  }>;
}

export interface ConversionTimeData {
  title: string;
  subtitle: string;
  totalTime: number;
  bestChannel: string;
  improvement: number;
  channels: Array<{ name: string; time: number; color: string }>;
  monthlyEvolution: Array<{ month: string; time: number }>;
  additionalMetrics: Array<{
    label: string;
    value: string | number;
    color?: string;
  }>;
  aiInsight: string;
}

export interface NoShowCancellationData {
  title: string;
  subtitle: string;
  totalCount: number;
  percentage: number;
  revenue: number;
  change: number;
  metrics: Array<{
    name: string;
    value: number;
    percentage: number;
    revenue?: number;
  }>;
  dayData: Array<{ day: string; count: number }>;
  motives: Array<{ label: string; count: number; percentage: number }>;
  recentItems: Array<{
    name: string;
    date: string;
    time?: string;
    reason?: string;
    revenue: number;
    status?: 'Reagendado' | 'Perdido' | 'Agendado';
    observation?: string;
  }>;
}

export interface ResponseSpeedData {
  title: string;
  subtitle: string;
  avgResponseTime: number;
  fastResponsePercentage: number;
  extraRevenue: number;
  timeRangeData: Array<{
    range: string;
    leads: number;
    qualified: number;
    scheduled: number;
    attended: number;
    qualificationRate: number;
    schedulingRate: number;
    attendanceRate: number;
  }>;
  sdrData: Array<{
    name: string;
    avgResponseTime: number;
    qualificationRate: number;
    schedulingRate: number;
    attendanceRate: number;
  }>;
  speedGoal?: string;
  speedGoalPercentage?: number;
  impactInsight?: string;
  aiInsight?: string;
}

export interface LostLeadsData {
  title: string;
  subtitle: string;
  totalLost: number;
  lostPercentage: number;
  lostRevenue: number;
  topObjections: Array<{
    tag: string;
    count: number;
    percentage: number;
  }>;
  channels: Array<{
    channel: string;
    color: string;
    lostLeads: number;
    percentage: number;
    topMotives: Array<{
      motive: string;
      count: number;
      percentage: number;
    }>;
    tags: Array<{
      tag: string;
      count: number;
      percentage: number;
    }>;
  }>;
  aiInsight?: string;
}

export interface AlertsData {
  title: string;
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'success' | 'info';
    title: string;
    timeAgo: string;
  }>;
}

// API Endpoints
export const executiveCardsAPI = {
  getLeadsCard: async (since: string, until: string) => {
    try {
      const response = await api.get<{ success: boolean; data: LeadsCardData }>(
        '/dashboard/executive/leads',
        { params: { since, until } }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar LeadsCard:', error);
      throw error;
    }
  },

  getSalesByFunnelCard: async (since: string, until: string) => {
    try {
      const response = await api.get<{ success: boolean; data: SalesByFunnelData }>(
        '/dashboard/executive/sales-by-funnel',
        { params: { since, until } }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar SalesByFunnelCard:', error);
      throw error;
    }
  },

  getConversionTimeCard: async (since: string, until: string) => {
    try {
      const response = await api.get<{ success: boolean; data: ConversionTimeData }>(
        '/dashboard/executive/conversion-time',
        { params: { since, until } }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar ConversionTimeCard:', error);
      throw error;
    }
  },

  getNoShowCancellationCard: async (since: string, until: string) => {
    try {
      const response = await api.get<{ success: boolean; data: NoShowCancellationData }>(
        '/dashboard/executive/no-shows',
        { params: { since, until } }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar NoShowCancellationCard:', error);
      throw error;
    }
  },

  getResponseSpeedCard: async (since: string, until: string) => {
    try {
      const response = await api.get<{ success: boolean; data: ResponseSpeedData }>(
        '/dashboard/executive/response-speed',
        { params: { since, until } }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar ResponseSpeedCard:', error);
      throw error;
    }
  },

  getLostLeadsCard: async (since: string, until: string) => {
    try {
      const response = await api.get<{ success: boolean; data: LostLeadsData }>(
        '/dashboard/executive/lost-leads',
        { params: { since, until } }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar LostLeadsCard:', error);
      throw error;
    }
  },

  getAlertsCard: async () => {
    try {
      const response = await api.get<{ success: boolean; data: AlertsData }>(
        '/dashboard/executive/alerts'
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar AlertsCard:', error);
      throw error;
    }
  },
};

// Custom Hooks para cada card
export const useLeadsCard = (since: string, until: string) => {
  const [data, setData] = useState<LeadsCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getLeadsCard(since, until);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useLeadsCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [since, until]);

  return { data, loading, error };
};

export const useSalesByFunnelCard = (since: string, until: string) => {
  const [data, setData] = useState<SalesByFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getSalesByFunnelCard(since, until);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useSalesByFunnelCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [since, until]);

  return { data, loading, error };
};

export const useConversionTimeCard = (since: string, until: string) => {
  const [data, setData] = useState<ConversionTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getConversionTimeCard(since, until);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useConversionTimeCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [since, until]);

  return { data, loading, error };
};

export const useNoShowCancellationCard = (since: string, until: string) => {
  const [data, setData] = useState<NoShowCancellationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getNoShowCancellationCard(since, until);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useNoShowCancellationCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [since, until]);

  return { data, loading, error };
};

export const useResponseSpeedCard = (since: string, until: string) => {
  const [data, setData] = useState<ResponseSpeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getResponseSpeedCard(since, until);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useResponseSpeedCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [since, until]);

  return { data, loading, error };
};

export const useLostLeadsCard = (since: string, until: string) => {
  const [data, setData] = useState<LostLeadsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getLostLeadsCard(since, until);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useLostLeadsCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [since, until]);

  return { data, loading, error };
};

export const useAlertsCard = () => {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await executiveCardsAPI.getAlertsCard();
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        console.error('Erro no useAlertsCard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};
