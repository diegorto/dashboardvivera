import { governanceAPI } from './api';

export interface AuditKPIs {
  totalRecordsAnalyzed: number;
  newRecords: number;
  modifiedRecords: number;
  deletedRecords: number;
  conflictsFound: number;
  possibleDuplicates: number;
  pendingApprovals: number;
  approvedChanges: number;
  rejectedChanges: number;
  executedSyncs: number;
  failedSyncs: number;
  avgSyncTime: number;
  connectedSources: number;
  dataIntegrity: number;
  approvalRate: number;
}

export interface AuditStats {
  totalBatches: number;
  totalChanges: number;
  avgChangesPerBatch: number;
  approvalRate: number;
  conflictRate: number;
  batchesByStatus: {
    pending: number;
    processing: number;
    finalized: number;
  };
}

export interface AuditChartDataPoint {
  date: string;
  batches: number;
  changes: number;
  approvalRate?: number;
}

class GovernanceDashboardService {
  async getAuditDashboardData() {
    try {
      const [kpisResponse, statsResponse] = await Promise.all([
        governanceAPI.getAuditKPIs(),
        governanceAPI.getAuditStats(30),
      ]);

      const kpis = kpisResponse.data as AuditKPIs;
      const stats = statsResponse.data as AuditStats;

      return { kpis, stats };
    } catch (error) {
      console.error('Erro ao carregar dados de auditoria:', error);
      throw error;
    }
  }

  formatNumber(value: number, decimals = 0): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(decimals) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(decimals) + 'K';
    }
    return value.toString();
  }

  formatPercentage(value: number, decimals = 1): string {
    return value.toFixed(decimals) + '%';
  }

  calculateTrend(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  generateChartData(stats: AuditStats): AuditChartDataPoint[] {
    const data: AuditChartDataPoint[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const batchesPerDay = Math.floor(stats.totalBatches / 30);
      const changesPerDay = Math.floor(stats.totalChanges / 30);

      data.push({
        date: date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        batches: Math.max(1, Math.floor(batchesPerDay + Math.random() * batchesPerDay * 0.3)),
        changes: Math.max(5, Math.floor(changesPerDay + Math.random() * changesPerDay * 0.4)),
        approvalRate: Math.round(stats.approvalRate * (0.95 + Math.random() * 0.1) * 100) / 100,
      });
    }

    return data;
  }

  getKPIMetadata(kpiName: string): { label: string; color: string; description: string } {
    const metadata: Record<string, any> = {
      totalRecordsAnalyzed: {
        label: 'Total de Registros Analisados',
        color: '#0284c7',
        description: 'Quantidade total de registros processados',
      },
      newRecords: {
        label: 'Registros Novos',
        color: '#10b981',
        description: 'Novos registros criados',
      },
      modifiedRecords: {
        label: 'Registros Modificados',
        color: '#f59e0b',
        description: 'Registros alterados',
      },
      deletedRecords: {
        label: 'Registros Deletados',
        color: '#ef4444',
        description: 'Registros removidos',
      },
      conflictsFound: {
        label: 'Conflitos Encontrados',
        color: '#ef4444',
        description: 'Divergências entre fontes de dados',
      },
      possibleDuplicates: {
        label: 'Possíveis Duplicatas',
        color: '#f97316',
        description: 'Registros potencialmente duplicados',
      },
      pendingApprovals: {
        label: 'Pendentes de Aprovação',
        color: '#f59e0b',
        description: 'Itens aguardando ação',
      },
      approvedChanges: {
        label: 'Mudanças Aprovadas',
        color: '#10b981',
        description: 'Registros aprovados',
      },
      approvalRate: {
        label: 'Taxa de Aprovação',
        color: '#10b981',
        description: 'Percentual de aprovações',
      },
      conflictRate: {
        label: 'Taxa de Conflitos',
        color: '#ef4444',
        description: 'Percentual de conflitos',
      },
      executedSyncs: {
        label: 'Sincronizações Executadas',
        color: '#0284c7',
        description: 'Sincronizações realizadas com sucesso',
      },
      dataIntegrity: {
        label: 'Integridade dos Dados',
        color: '#10b981',
        description: 'Qualidade geral dos dados',
      },
    };

    return metadata[kpiName] || {
      label: kpiName,
      color: '#6366f1',
      description: '',
    };
  }
}

export default new GovernanceDashboardService();
