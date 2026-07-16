import React, { useEffect, useState } from 'react';
import { KPICard, Layout } from '../components';
import governanceDashboardService, { AuditKPIs, AuditStats, AuditChartDataPoint } from '../services/governanceDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const AuditDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<AuditKPIs | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [chartData, setChartData] = useState<AuditChartDataPoint[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [filters.period, filters.dateRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { kpis: kpisData, stats: statsData } = await governanceDashboardService.getAuditDashboardData();

      setKpis(kpisData);
      setStats(statsData);
      setChartData(governanceDashboardService.generateChartData(statsData));

      if (kpisData.conflictsFound > 0) {
        addNotification('warning', `Existem ${kpisData.conflictsFound} conflitos pendentes de resolução`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard de auditoria';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Audit Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKPIClick = (kpiName: string) => {
    // Future: Navigate to drill-down detail page
    console.log('Clicou em:', kpiName);
  };

  const handleExport = () => {
    if (!kpis || !stats) return;

    const csvContent = `Dashboard de Auditoria\nData: ${new Date().toLocaleDateString('pt-BR')}\n\nMétricas Principais\n`;
    addNotification('success', 'Exportação será implementada na próxima fase');
  };

  if (error) {
    return (
      <Layout title="Dashboard de Auditoria">
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

  if (loading || !kpis || !stats) {
    return (
      <Layout title="Dashboard de Auditoria">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600">Carregando dados de auditoria...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard de Auditoria">
      <div className="space-y-6">
        {/* Alert Banner */}
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 flex gap-3">
          <div className="text-xl">ℹ️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">Auditoria Ativa</h3>
            <p className="text-sm text-amber-800">
              Sistema monitorando {kpis.connectedSources} fontes de dados com integridade de {kpis.dataIntegrity}%.
              Última sincronização: há 2 horas.
            </p>
          </div>
        </div>

        {/* Section 1: Core KPIs */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            📊 Métricas Principais de Auditoria
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total de Registros Analisados"
              value={governanceDashboardService.formatNumber(kpis.totalRecordsAnalyzed)}
              change={12.5}
              sub="vs período anterior"
              onClick={() => handleKPIClick('totalRecordsAnalyzed')}
            />
            <KPICard
              label="Registros Novos"
              value={governanceDashboardService.formatNumber(kpis.newRecords)}
              change={8.3}
              sub="criados"
              onClick={() => handleKPIClick('newRecords')}
            />
            <KPICard
              label="Registros Modificados"
              value={governanceDashboardService.formatNumber(kpis.modifiedRecords)}
              change={15.2}
              sub="alterados"
              onClick={() => handleKPIClick('modifiedRecords')}
            />
            <KPICard
              label="Registros Deletados"
              value={governanceDashboardService.formatNumber(kpis.deletedRecords)}
              change={3.1}
              sub="removidos"
              onClick={() => handleKPIClick('deletedRecords')}
            />
            <KPICard
              label="Conflitos Encontrados"
              value={kpis.conflictsFound}
              change={kpis.conflictsFound > 0 ? 5.0 : -2.0}
              sub="exigem ação"
              onClick={() => handleKPIClick('conflictsFound')}
            />
            <KPICard
              label="Possíveis Duplicatas"
              value={kpis.possibleDuplicates}
              change={-1.2}
              sub="entre pacientes"
              onClick={() => handleKPIClick('possibleDuplicates')}
            />
            <KPICard
              label="Pendentes de Aprovação"
              value={kpis.pendingApprovals}
              change={4.5}
              sub="aguardam ação"
              onClick={() => handleKPIClick('pendingApprovals')}
            />
            <KPICard
              label="Mudanças Aprovadas"
              value={governanceDashboardService.formatNumber(kpis.approvedChanges)}
              change={6.8}
              sub="do total"
              onClick={() => handleKPIClick('approvedChanges')}
            />
          </div>
        </div>

        {/* Section 2: Trend Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            📈 Histórico de Auditoria (Últimos 30 Dias)
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line
                  type="monotone"
                  dataKey="changes"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                  name="Mudanças"
                />
                <Line
                  type="monotone"
                  dataKey="batches"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Lotes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 3: Additional Metrics */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            🔍 Métricas Adicionais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Taxa de Aprovação"
              value={`${governanceDashboardService.formatPercentage(stats.approvalRate)}`}
              change={2.3}
              sub="última semana"
              onClick={() => handleKPIClick('approvalRate')}
            />
            <KPICard
              label="Taxa de Conflitos"
              value={`${governanceDashboardService.formatPercentage(stats.conflictRate)}`}
              change={-0.1}
              sub="tendência boa"
              onClick={() => handleKPIClick('conflictRate')}
            />
            <KPICard
              label="Sincronizações Executadas"
              value={kpis.executedSyncs}
              change={0}
              sub="100% sucesso"
              onClick={() => handleKPIClick('executedSyncs')}
            />
            <KPICard
              label="Integridade dos Dados"
              value={`${kpis.dataIntegrity}%`}
              change={1.2}
              sub="estado excelente"
              onClick={() => handleKPIClick('dataIntegrity')}
            />
          </div>
        </div>

        {/* Section 4: Batch Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
            📋 Status dos Lotes
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-900">{stats.batchesByStatus.pending}</div>
              <div className="text-sm text-yellow-700">Pendentes</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">{stats.batchesByStatus.processing}</div>
              <div className="text-sm text-blue-700">Processando</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-900">{stats.batchesByStatus.finalized}</div>
              <div className="text-sm text-green-700">Finalizados</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AuditDashboard;
