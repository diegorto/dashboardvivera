import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import crmDashboardService, { CRMKPIs, PipelineStage, RecoveryOpportunity } from '../services/crmDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { ExportButton } from '../utils/dashboardHelpers';

const CRMDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<CRMKPIs | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [recovery, setRecovery] = useState<RecoveryOpportunity[]>([]);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [filters.period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period);
      const data = await crmDashboardService.getFullCRMDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setPipeline(data.pipeline);
      setRecovery(data.recovery);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar CRM Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period: string) => {
    const until = new Date();
    const since = new Date();

    switch (period) {
      case 'today':
        since.setDate(since.getDate());
        break;
      case 'week':
        since.setDate(since.getDate() - 7);
        break;
      case 'year':
        since.setFullYear(since.getFullYear() - 1);
        break;
      case 'month':
      default:
        since.setDate(since.getDate() - 30);
    }

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { since: fmt(since), until: fmt(until) };
  };

  const formatValue = (value: number, type: 'currency' | 'number' | 'days' = 'number') => {
    switch (type) {
      case 'currency':
        return value >= 1000000
          ? `R$ ${(value / 1000000).toFixed(2)}M`
          : value >= 1000
          ? `R$ ${(value / 1000).toFixed(0)}K`
          : `R$ ${value.toFixed(0)}`;
      case 'days':
        return `${value.toFixed(1)}d`;
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  // Etapa com maior tempo medio = gargalo
  const maxAvgDays = Math.max(...pipeline.map(s => s.avgDays), 0);

  if (error) {
    return (
      <Layout title="CRM Intelligence">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dashboard</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading || !kpis) {
    return (
      <Layout title="CRM Intelligence">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const exportData = kpis ? [
    { 'Métrica': 'Deals Abertos', 'Valor': kpis.openDeals, 'Tipo': 'Quantity' },
    { 'Métrica': 'Valor Pipeline', 'Valor': kpis.pipelineValue, 'Tipo': 'Currency' },
    { 'Métrica': 'Tempo Médio', 'Valor': `${kpis.avgStageTime} dias`, 'Tipo': 'Duration' },
    { 'Métrica': 'Deals Perdidos', 'Valor': kpis.lostDeals, 'Tipo': 'Quantity' },
    { 'Métrica': 'Oportunidades Recuperáveis', 'Valor': kpis.recoverable, 'Tipo': 'Quantity' },
    { 'Métrica': 'Deals Ganhos', 'Valor': kpis.wonDeals, 'Tipo': 'Quantity' }
  ] : [];

  return (
    <Layout title="CRM Intelligence" breadcrumb={['Dashboard', 'CRM']} right={<ExportButton filename="crm-dashboard" rows={exportData} />}>
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Pipeline Aberto</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.openDeals)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Valor do Pipeline</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.pipelineValue, 'currency')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Tempo Médio Etapa</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.avgStageTime, 'days')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#f59e0b]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Perdidos</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.lostDeals)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#ef4444]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Recuperáveis</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.recoverable)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Pipeline — Kanban por Etapa</h3>
          <div className="text-[11px] text-[#64748b]">Clique na etapa para ver os deals</div>
        </div>

        {pipeline.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-2">
              {pipeline.map((stage) => (
                <div
                  key={stage.stageId}
                  className="w-56 flex-shrink-0 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg cursor-pointer hover:border-[#6366f1] transition-colors"
                  onClick={() => setExpandedStage(expandedStage === stage.stageId ? null : stage.stageId)}
                >
                  <div className="px-4 py-3 border-b border-[#e2e8f0]">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[12px] font-semibold text-[#0f172a]">{stage.stageName}</div>
                      <div className="text-[11px] font-bold text-[#6366f1]">{stage.count}</div>
                    </div>
                    <div className="text-[11px] text-[#64748b] font-mono">{formatValue(stage.value, 'currency')}</div>
                    <div className="mt-2 flex items-center gap-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{
                          color: stage.avgDays === maxAvgDays && maxAvgDays > 0 ? '#ef4444' : '#64748b',
                          backgroundColor: stage.avgDays === maxAvgDays && maxAvgDays > 0 ? '#fee2e2' : '#f1f5f9'
                        }}
                      >
                        {stage.avgDays === maxAvgDays && maxAvgDays > 0 ? '⚠ Gargalo: ' : ''}
                        {formatValue(stage.avgDays, 'days')} médio
                      </span>
                    </div>
                  </div>

                  {expandedStage === stage.stageId && (
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#f1f5f9]">
                      {stage.deals.length > 0 ? stage.deals.map((deal) => (
                        <div key={deal.id} className="px-4 py-2 hover:bg-white transition-colors">
                          <div className="text-[11px] font-semibold text-[#0f172a] truncate">{deal.title}</div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-[#94a3b8]">{deal.personName || '—'}</span>
                            <span className="text-[10px] font-mono text-[#334155]">{formatValue(deal.value, 'currency')}</span>
                          </div>
                          <div className="text-[10px] text-[#94a3b8] mt-0.5">{deal.daysInStage}d na etapa</div>
                        </div>
                      )) : (
                        <div className="px-4 py-3 text-[11px] text-[#94a3b8] text-center">Sem deals</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-500">Sem dados de pipeline</div>
        )}
      </div>

      {/* Gargalos - Tempo por etapa */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="mb-4">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Gargalos — Tempo Médio por Etapa</h3>
        </div>

        <div className="space-y-3">
          {pipeline.map((stage) => (
            <div key={stage.stageId}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[12px] font-semibold text-[#0f172a]">{stage.stageName}</div>
                <div className="text-[12px] text-[#94a3b8] font-mono">{formatValue(stage.avgDays, 'days')}</div>
              </div>
              <div className="w-full bg-[#e2e8f0] rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${maxAvgDays > 0 ? (stage.avgDays / maxAvgDays) * 100 : 0}%`,
                    backgroundColor: stage.avgDays === maxAvgDays && maxAvgDays > 0 ? '#ef4444' : '#6366f1'
                  }}
                />
              </div>
            </div>
          ))}
          {pipeline.length === 0 && (
            <div className="text-center py-4 text-gray-500">Sem dados</div>
          )}
        </div>
      </div>

      {/* Recuperação de Oportunidades */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Recuperação de Oportunidades</h3>
          <div className="text-[11px] text-[#64748b]">{recovery.length} oportunidades perdidas (maior valor primeiro)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Oportunidade</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Paciente</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Valor</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Motivo</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Data Perda</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Origem</th>
              </tr>
            </thead>
            <tbody>
              {recovery.map((opp) => (
                <tr key={opp.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-semibold text-[#0f172a] whitespace-nowrap">{opp.title}</td>
                  <td className="px-3 py-3 text-[#334155] whitespace-nowrap">{opp.personName || '—'}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(opp.value, 'currency')}</td>
                  <td className="px-3 py-3 text-[#334155]">
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[#fee2e2] text-[#ef4444]">
                      {opp.lostReason}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#334155] font-mono whitespace-nowrap">{opp.lostDate || '—'}</td>
                  <td className="px-3 py-3 text-[#334155] whitespace-nowrap">{opp.origem || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recovery.length === 0 && (
          <div className="text-center py-8 text-gray-500">Nenhuma oportunidade perdida no período</div>
        )}
      </div>
    </Layout>
  );
};

export default CRMDashboard;
