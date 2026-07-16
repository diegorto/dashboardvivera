// Types - Vivera Command Center

// KPI Types
export interface KPI {
  id: string;
  title: string;
  value: number;
  comparison: number; // percentage change
  comparisonText: string; // "vs mês anterior"
  trend: 'up' | 'down' | 'stable';
  icon: string; // lucide icon name
  status: 'ok' | 'warning' | 'critical'; // verde/amarelo/vermelho
  tooltip?: string;
  drillDownPath?: string[]; // path for drill-down
}

// Marketing Types
export interface Campaign {
  id: string;
  name: string;
  revenue: number;
  investment: number;
  roas: number;
  leads: number;
  purchases: number;
  ticket: number;
  cac: number;
  ctr: number;
  cpc: number;
  trend: number;
}

export interface Creative {
  id: string;
  name: string;
  thumbnail: string;
  preview: string;
  metaLink: string;
  status: 'active' | 'paused' | 'archived';
  revenue: number;
  investment: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  ticket: number;
  revenuePerLead: number;
  revenuePerAppointment: number;
  trend: number;
  saturation: number; // 0-100
  aiInsight?: string;
}

// Patient Types
export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  origin: 'Google' | 'Meta' | 'Organic' | 'Referral' | 'Reception' | 'WhatsApp';
  campaign?: string;
  creative?: string;
  procedure: string;
  professional: string;
  pipeline: string;
  status: string;
  revenue: number;
  appointmentDate?: Date;
  purchaseDate?: Date;
  timeline: TimelineEvent[];
  whatsappHistory?: WhatsappMessage[];
}

export interface TimelineEvent {
  id: string;
  stage: 'lead' | 'qualified' | 'scheduled' | 'attended' | 'purchased' | 'follow_up';
  date: Date;
  time: string;
  responsible: string;
  durationFromPrevious?: number; // minutes
  notes?: string;
}

export interface WhatsappMessage {
  id: string;
  type: 'sent' | 'received' | 'call';
  content?: string;
  timestamp: Date;
  duration?: number; // for calls
  status: 'delivered' | 'read' | 'failed';
}

// Commercial Types
export interface Commercial {
  id: string;
  name: string;
  leads: number;
  qualified: number;
  scheduled: number;
  attended: number;
  purchased: number;
  conversion: number;
  ticket: number;
  revenue: number;
  firstContactTime: number;
  saleTime: number;
}

// CRM Types
export interface Pipeline {
  id: string;
  name: string;
  stage: string;
  owner: string;
  revenue: number;
  expectedCloseDate: Date;
  probability: number; // 0-100
}

export interface Opportunity {
  id: string;
  title: string;
  value: number;
  stage: string;
  daysInStage: number;
  bottleneck?: boolean;
  nextAction?: string;
  aiSuggestion?: string;
}

// Chart Data
export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface FunnelStage {
  name: string;
  quantity: number;
  percentage: number;
  revenue: number;
  lostRevenue: number;
  averageTime: number;
  conversion: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter Types
export interface GlobalFilters {
  period: 'today' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'last30' | 'year' | 'custom';
  procedure?: string;
  professional?: string;
  sdr?: string;
  campaign?: string;
  creative?: string;
  pipeline?: string;
  origin?: string;
  status?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

// Alert Types
export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  change?: number;
  actionUrl?: string;
  timestamp: Date;
}

// AI Insight Types
export interface AIInsight {
  whatHappened: string;
  why: string;
  financialImpact: number;
  recommendedAction: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

export interface AIPanel {
  insights: AIInsight[];
  topBottleneck?: string;
  topOpportunity?: string;
  bestCampaign?: string;
  worstCampaign?: string;
  bestProfessional?: string;
  bestSDR?: string;
  revenueForcast?: number;
  monthlyRisk?: string;
}
