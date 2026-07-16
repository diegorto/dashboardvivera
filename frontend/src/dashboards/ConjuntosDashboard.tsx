import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtCurrency, fmtNumber, fmtMult, LoadingScreen, ErrorScreen, MiniKpi, CardBox, Th, Td, ExportButton } from '../utils/dashboardHelpers';

interface AdSet {
  campaign: string;
  adset: string;
  spend: number;
  leads: number;
  revenue: number;
  sales: number;
  roas: number;
  cpl: number;
}

const ConjuntosDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [sortBy, setSortBy] = useState<keyof AdSet>('spend');

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period, filters.dateRange);
      const r = await axios.get('/api/dashboard/marketing/adsets', { params: { since, until } });
      setAdsets(r.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period, filters.dateRange]);

  if (error) return <ErrorScreen title="Conjuntos" error={error} onRetry={load} />;
  if (loading) return <LoadingScreen title="Conjuntos" />;

  const sorted = [...adsets].sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0));

  return (
    <Layout title="Conjuntos de Anúncio" breadcrumb={['Dashboard', 'Conjuntos']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Conjuntos" value={fmtNumber(adsets.length)} color="#0ea5e9" />
        <MiniKpi label="Investimento" value={fmtCurrency(adsets.reduce((s, a) => s + a.spend, 0))} color="#ef4444" />
        <MiniKpi label="Leads" value={fmtNumber(adsets.reduce((s, a) => s + a.leads, 0))} color="#6366f1" />
        <MiniKpi label="Vendas" value={fmtNumber(adsets.reduce((s, a) => s + a.sales, 0))} color="#10b981" />
      </div>

      <CardBox title="Conjuntos — Campanha → Conjunto" right={<ExportButton filename="conjuntos" rows={adsets as unknown as Record<string, unknown>[]} />}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Campanha</Th>
                <Th>Conjunto</Th>
                <Th right onClick={() => setSortBy('spend')} active={sortBy === 'spend'}>Investimento</Th>
                <Th right onClick={() => setSortBy('leads')} active={sortBy === 'leads'}>Leads</Th>
                <Th right onClick={() => setSortBy('cpl')} active={sortBy === 'cpl'}>CPL</Th>
                <Th right onClick={() => setSortBy('sales')} active={sortBy === 'sales'}>Vendas</Th>
                <Th right onClick={() => setSortBy('revenue')} active={sortBy === 'revenue'}>Receita</Th>
                <Th right onClick={() => setSortBy('roas')} active={sortBy === 'roas'}>ROAS</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => (
                <tr key={i} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                  <Td>{a.campaign}</Td>
                  <Td bold>{a.adset}</Td>
                  <Td right mono>{fmtCurrency(a.spend)}</Td>
                  <Td right mono>{fmtNumber(a.leads)}</Td>
                  <Td right mono>{fmtCurrency(a.cpl)}</Td>
                  <Td right mono>{fmtNumber(a.sales)}</Td>
                  <Td right mono>{fmtCurrency(a.revenue)}</Td>
                  <Td right mono>{fmtMult(a.roas)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {adsets.length === 0 && <div className="text-center py-8 text-gray-500">Sem dados do Meta Ads no período (verifique o token em Configurações)</div>}
      </CardBox>
    </Layout>
  );
};

export default ConjuntosDashboard;
