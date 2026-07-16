import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components';
import commercialDashboardService, { LossReason } from '../services/commercialDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtNumber, fmtCurrency, LoadingScreen, ErrorScreen, MiniKpi, CardBox, Th, Td, ExportButton } from '../utils/dashboardHelpers';

interface LostPatient {
  id: number;
  name: string;
  value: number;
  lostReason: string;
  campanha: string;
  owner: string;
  addDate: string;
}

const ObjectionsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<LossReason[]>([]);
  const [lost, setLost] = useState<LostPatient[]>([]);
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period, filters.dateRange);
      const [r, p] = await Promise.all([
        commercialDashboardService.getLossReasons(since, until),
        axios.get('/api/dashboard/patients', { params: { since, until } })
      ]);
      setReasons(r);
      setLost(p.data.data.filter((x: { status: string }) => x.status === 'lost'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period, filters.dateRange]);

  if (error) return <ErrorScreen title="Objeções" error={error} onRetry={load} />;
  if (loading) return <LoadingScreen title="Objeções" />;

  const maxQty = Math.max(...reasons.map(r => r.quantity), 1);
  const filteredLost = reasonFilter === 'all' ? lost : lost.filter(l => (l.lostReason || 'Motivo desconhecido') === reasonFilter);

  return (
    <Layout title="Objeções e Motivos de Perda" breadcrumb={['Dashboard', 'Objeções']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <MiniKpi label="Oportunidades Perdidas" value={fmtNumber(lost.length)} color="#ef4444" />
        <MiniKpi label="Motivos Distintos" value={fmtNumber(reasons.length)} color="#f59e0b" />
      </div>

      <CardBox title="Ranking de Motivos (clique para filtrar)">
        <div className="divide-y divide-[#f1f5f9]">
          {reasons.map((r, i) => (
            <div
              key={i}
              className="px-5 py-3 cursor-pointer hover:bg-[#f8fafc]"
              onClick={() => setReasonFilter(reasonFilter === r.reason ? 'all' : r.reason)}
              style={{ backgroundColor: reasonFilter === r.reason ? '#eef2ff' : undefined }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold text-[#0f172a]">{i + 1}. {r.reason}</span>
                <span className="text-[12px] text-[#94a3b8]">{r.quantity} ({r.percentage}%)</span>
              </div>
              <div className="w-full bg-[#e2e8f0] rounded-full h-2">
                <div className="bg-[#ef4444] h-2 rounded-full" style={{ width: `${(r.quantity / maxQty) * 100}%` }} />
              </div>
            </div>
          ))}
          {reasons.length === 0 && <div className="text-center py-8 text-gray-500">Sem perdas registradas no período</div>}
        </div>
      </CardBox>

      <CardBox
        title={reasonFilter === 'all' ? `Todas as Perdas (${filteredLost.length})` : `Perdas: ${reasonFilter} (${filteredLost.length})`}
        right={<ExportButton filename="objecoes" rows={filteredLost as unknown as Record<string, unknown>[]} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Paciente</Th>
                <Th>Motivo</Th>
                <Th right>Valor</Th>
                <Th>Campanha</Th>
                <Th>Responsável</Th>
                <Th>Data</Th>
              </tr>
            </thead>
            <tbody>
              {filteredLost.slice(0, 150).map(l => (
                <tr key={l.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                  <Td bold>{l.name}</Td>
                  <Td>{l.lostReason || 'Motivo desconhecido'}</Td>
                  <Td right mono>{fmtCurrency(l.value)}</Td>
                  <Td>{l.campanha || '—'}</Td>
                  <Td>{l.owner || '—'}</Td>
                  <Td mono>{l.addDate}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBox>
    </Layout>
  );
};

export default ObjectionsDashboard;
