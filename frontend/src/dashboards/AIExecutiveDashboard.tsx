import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import aiDashboardService, { AIInsight, AINarrative, InsightSeverity } from '../services/aiDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { useAppStore } from '../stores/appStore';

const severityStyle: Record<InsightSeverity, { color: string; bg: string; border: string; label: string }> = {
  success: { color: '#10b981', bg: '#dcfce7', border: '#86efac', label: 'Positivo' },
  info: { color: '#0ea5e9', bg: '#e0f2fe', border: '#7dd3fc', label: 'Informação' },
  warning: { color: '#f59e0b', bg: '#fef3c7', border: '#fcd34d', label: 'Atenção' },
  critical: { color: '#ef4444', bg: '#fee2e2', border: '#fca5a5', label: 'Crítico' }
};

const trendIcon: Record<string, string> = {
  up: '↑',
  down: '↓',
  stable: '→'
};

const AIExecutiveDashboard: React.FC = () => {
  const { filters } = useFilters();
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [narrative, setNarrative] = useState<AINarrative | null>(null);
  const [severityFilter, setSeverityFilter] = useState<InsightSeverity | 'all'>('all');

  useEffect(() => {
    loadDashboardData();
  }, [filters.period]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange(filters.period);
      const data = await aiDashboardService.getFullAIDashboard(dateRange.since, dateRange.until);

      setInsights(data.insights);
      setNarrative(data.narrative);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar IA Executive Dashboard:', err);
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

  const filteredInsights = severityFilter === 'all'
    ? insights
    : insights.filter(i => i.severity === severityFilter);

  const severityCounts = insights.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});

  if (error) {
    return (
      <Layout title="IA Executive">
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

  if (loading) {
    return (
      <Layout title="IA Executive">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Analisando dados...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="IA Executive" breadcrumb={['Dashboard', 'IA Executive']}>
      {/* Narrativa Executiva */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[16px]">✨</span>
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Resumo Executivo — IA</h3>
        </div>

        {narrative?.available && narrative.narrative ? (
          <p className="text-[13px] text-[#334155] leading-relaxed whitespace-pre-line">
            {narrative.narrative}
          </p>
        ) : (
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-4 py-3">
            <p className="text-[12px] text-[#64748b]">
              Resumo narrativo indisponível
              {narrative?.reason ? ` (${narrative.reason})` : ''}.
              Os insights estruturados abaixo continuam sendo gerados dos dados reais.
            </p>
          </div>
        )}
      </div>

      {/* Contadores por severidade + filtro */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setSeverityFilter('all')}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: severityFilter === 'all' ? '#ffffff' : '#64748b',
            backgroundColor: severityFilter === 'all' ? '#6366f1' : '#f1f5f9'
          }}
        >
          Todos ({insights.length})
        </button>
        {(Object.keys(severityStyle) as InsightSeverity[]).map(sev => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: severityFilter === sev ? '#ffffff' : severityStyle[sev].color,
              backgroundColor: severityFilter === sev ? severityStyle[sev].color : severityStyle[sev].bg
            }}
          >
            {severityStyle[sev].label} ({severityCounts[sev] || 0})
          </button>
        ))}
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInsights.map((insight) => {
          const style = severityStyle[insight.severity];
          return (
            <div
              key={insight.id}
              className="bg-white border rounded-xl p-5"
              style={{ borderColor: style.border }}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-[13px] font-semibold text-[#0f172a]">{insight.title}</h4>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: style.color, backgroundColor: style.bg }}
                  >
                    {style.label}
                  </span>
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: insight.trend === 'up' ? '#10b981' : insight.trend === 'down' ? '#ef4444' : '#94a3b8' }}
                  >
                    {trendIcon[insight.trend]}
                  </span>
                </div>
              </div>

              <p className="text-[12px] text-[#334155] mb-3 leading-relaxed">
                {insight.description}
              </p>

              <div className="bg-[#f8fafc] border border-[#f1f5f9] rounded-lg px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1">
                  Recomendação
                </div>
                <p className="text-[12px] text-[#334155]">{insight.recommendation}</p>
              </div>
            </div>
          );
        })}
      </div>

      {filteredInsights.length === 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 text-center text-gray-500">
          {insights.length === 0
            ? 'Sem dados suficientes no período para gerar insights. Conecte Meta Ads e Pipedrive.'
            : 'Nenhum insight nesta categoria.'}
        </div>
      )}
    </Layout>
  );
};

export default AIExecutiveDashboard;
