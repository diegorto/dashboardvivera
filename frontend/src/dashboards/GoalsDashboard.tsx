import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtCurrency, fmtNumber, fmtPct, LoadingScreen, ErrorScreen, MiniKpi, CardBox } from '../utils/dashboardHelpers';

interface GoalData {
  revenue: number;
  goal: number;
  goalPct: number;
  sales: number;
  leads: number;
}

const GoalsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GoalData | null>(null);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period);
      const r = await axios.get('/api/dashboard/executive', { params: { since, until } });
      const k = r.data.data;
      setData({
        revenue: Number(k.revenue?.value) || 0,
        goal: Number(k.goal?.value) || 0,
        goalPct: parseFloat(k.goalPct?.value) || 0,
        sales: Number(k.sales?.value) || 0,
        leads: Number(k.leads?.value) || 0
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period]);

  if (error) return <ErrorScreen title="Metas" error={error} onRetry={load} />;
  if (loading || !data) return <LoadingScreen title="Metas" />;

  const pct = Math.min(data.goalPct, 100);
  const remaining = Math.max(data.goal - data.revenue, 0);
  const barColor = data.goalPct >= 100 ? '#10b981' : data.goalPct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <Layout title="Metas" breadcrumb={['Dashboard', 'Metas']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Meta do Período" value={fmtCurrency(data.goal)} color="#6366f1" />
        <MiniKpi label="Realizado" value={fmtCurrency(data.revenue)} color="#10b981" />
        <MiniKpi label="% da Meta" value={fmtPct(data.goalPct)} color={barColor} />
        <MiniKpi label="Falta" value={fmtCurrency(remaining)} color="#ef4444" />
      </div>

      <CardBox title="Progresso da Meta de Receita">
        <div className="p-6">
          <div className="w-full bg-[#e2e8f0] rounded-full h-6 mb-3">
            <div
              className="h-6 rounded-full flex items-center justify-end pr-3 transition-all"
              style={{ width: `${pct}%`, backgroundColor: barColor, minWidth: pct > 0 ? '3rem' : 0 }}
            >
              {pct > 5 && <span className="text-[11px] font-bold text-white">{fmtPct(data.goalPct)}</span>}
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-[#94a3b8]">
            <span>R$ 0</span>
            <span>{fmtCurrency(data.goal)}</span>
          </div>
          <p className="text-[12px] text-[#64748b] mt-4">
            {data.goalPct >= 100
              ? '🎉 Meta batida! Considere revisar a meta em Configurações para o próximo ciclo.'
              : `Faltam ${fmtCurrency(remaining)} para bater a meta. ${fmtNumber(data.sales)} vendas fechadas de ${fmtNumber(data.leads)} leads no período.`}
          </p>
          <p className="text-[11px] text-[#94a3b8] mt-2">
            A meta é definida em <Link to="/configuracoes" className="text-[#6366f1] font-semibold">Configurações → Meta de Receita Mensal</Link>.
          </p>
        </div>
      </CardBox>
    </Layout>
  );
};

export default GoalsDashboard;
