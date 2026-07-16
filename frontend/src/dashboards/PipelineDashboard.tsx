import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import crmDashboardService, { PipelineStage } from '../services/crmDashboardService';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtCurrency, fmtNumber, LoadingScreen, ErrorScreen, MiniKpi, CardBox, Th, Td, ExportButton } from '../utils/dashboardHelpers';

const PipelineDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period, filters.dateRange);
      setPipeline(await crmDashboardService.getPipeline(since, until));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period, filters.dateRange]);

  if (error) return <ErrorScreen title="Pipeline" error={error} onRetry={load} />;
  if (loading) return <LoadingScreen title="Pipeline" />;

  const totalDeals = pipeline.reduce((s, p) => s + p.count, 0);
  const totalValue = pipeline.reduce((s, p) => s + p.value, 0);
  const allDeals = pipeline.flatMap(s => s.deals.map(d => ({ etapa: s.stageName, ...d })));

  return (
    <Layout title="Pipeline" breadcrumb={['Dashboard', 'Pipeline']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <MiniKpi label="Deals Abertos" value={fmtNumber(totalDeals)} color="#0ea5e9" />
        <MiniKpi label="Valor Total" value={fmtCurrency(totalValue)} color="#10b981" />
        <MiniKpi label="Etapas" value={fmtNumber(pipeline.length)} color="#6366f1" />
      </div>

      <CardBox title="Deals por Etapa" right={<ExportButton filename="pipeline" rows={allDeals as unknown as Record<string, unknown>[]} />}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Etapa</Th>
                <Th>Deal</Th>
                <Th>Paciente</Th>
                <Th right>Valor</Th>
                <Th right>Dias na Etapa</Th>
                <Th>Campanha</Th>
              </tr>
            </thead>
            <tbody>
              {allDeals.slice(0, 200).map(d => (
                <tr key={d.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                  <Td bold>{d.etapa}</Td>
                  <Td>{d.title}</Td>
                  <Td>{d.personName || '—'}</Td>
                  <Td right mono>{fmtCurrency(d.value)}</Td>
                  <Td right mono>{d.daysInStage}d</Td>
                  <Td>{d.campanha || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allDeals.length === 0 && <div className="text-center py-8 text-gray-500">Pipeline vazio no período</div>}
      </CardBox>
    </Layout>
  );
};

export default PipelineDashboard;
