import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import { getDateRange, ExportButton } from '../utils/dashboardHelpers';
import whatsappDashboardService, { WhatsAppKPIs, AttendantRanking } from '../services/whatsappDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';

const WhatsAppDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<WhatsAppKPIs | null>(null);
  const [ranking, setRanking] = useState<AttendantRanking[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [filters.period, filters.dateRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period, filters.dateRange);
      const data = await whatsappDashboardService.getFullWhatsAppDashboard(
        dateRange.since,
        dateRange.until
      );

      setKpis(data.kpis);
      setRanking(data.ranking);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar WhatsApp Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };


  const formatValue = (value: number, type: 'number' | 'percentage' | 'minutes' = 'number') => {
    switch (type) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'minutes':
        return value > 0 ? `${value.toFixed(0)}min` : '—';
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  if (error) {
    return (
      <Layout title="WhatsApp Analytics">
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
      <Layout title="WhatsApp Analytics">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const integrationPending = kpis.messagesSent === 0 && kpis.messagesReceived === 0;

  const exportData = kpis ? [
    { 'Métrica': 'Mensagens Enviadas', 'Valor': kpis.messagesSent, 'Tipo': 'Quantity' },
    { 'Métrica': 'Mensagens Recebidas', 'Valor': kpis.messagesReceived, 'Tipo': 'Quantity' },
    { 'Métrica': 'Chamadas', 'Valor': kpis.calls, 'Tipo': 'Quantity' },
    { 'Métrica': 'Chamadas Perdidas', 'Valor': kpis.missedCalls, 'Tipo': 'Quantity' },
    { 'Métrica': 'Tempo Primeira Resposta (min)', 'Valor': kpis.avgFirstResponseTime, 'Tipo': 'Duration' },
    { 'Métrica': 'Tempo Médio Resposta (min)', 'Valor': kpis.avgResponseTime, 'Tipo': 'Duration' },
    { 'Métrica': 'Taxa de Conversão', 'Valor': `${kpis.conversionRate.toFixed(1)}%`, 'Tipo': 'Percentage' }
  ] : [];

  return (
    <Layout title="WhatsApp Analytics" breadcrumb={['Dashboard', 'WhatsApp']} right={<ExportButton filename="whatsapp-dashboard" rows={exportData} />}>
      {/* Aviso de integração pendente */}
      {integrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6">
          <p className="text-[12px] text-amber-800">
            <span className="font-semibold">Integração WhatsApp/Tintim pendente.</span>{' '}
            Métricas de mensagens e tempos de resposta serão exibidas quando a integração for configurada.
            Ligações e atividades já vêm do Pipedrive.
          </p>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Msgs Enviadas</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.messagesSent > 0 ? formatValue(kpis.messagesSent) : '—'}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Msgs Recebidas</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.messagesReceived > 0 ? formatValue(kpis.messagesReceived) : '—'}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Ligações</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.calls)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Perdidas</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.missedCalls)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#ef4444]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">1ª Resposta</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.avgFirstResponseTime, 'minutes')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#f59e0b]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Tempo Médio</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatValue(kpis.avgResponseTime, 'minutes')}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#8b5cf6]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Conversão</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.conversionRate > 0 ? formatValue(kpis.conversionRate, 'percentage') : '—'}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>
      </div>

      {/* Attendant Ranking */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Ranking de Atendentes</h3>
          <div className="text-[11px] text-[#64748b]">{ranking.length} atendentes (atividades Pipedrive)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">#</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Atendente</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Atividades</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Ligações</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Mensagens</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Concluídas</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Taxa Conclusão</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((att, index) => (
                <tr key={att.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-mono text-[#94a3b8]">{index + 1}</td>
                  <td className="px-3 py-3 font-semibold text-[#0f172a] whitespace-nowrap">{att.name}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(att.totalActivities)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(att.calls)}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{att.messages > 0 ? formatValue(att.messages) : '—'}</td>
                  <td className="px-3 py-3 text-right text-[#334155] font-mono">{formatValue(att.done)}</td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        color: att.completionRate >= 70 ? '#10b981' : '#f59e0b',
                        backgroundColor: att.completionRate >= 70 ? '#dcfce7' : '#fef3c7'
                      }}
                    >
                      {formatValue(att.completionRate, 'percentage')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ranking.length === 0 && (
          <div className="text-center py-8 text-gray-500">Nenhuma atividade no período</div>
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppDashboard;
