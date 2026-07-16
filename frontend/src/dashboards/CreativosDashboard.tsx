import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtCurrency, fmtNumber, fmtMult, LoadingScreen, ErrorScreen, MiniKpi, CardBox, Th, Td, ExportButton } from '../utils/dashboardHelpers';

interface Creative {
  id: string;
  name: string;
  campaign: string;
  adset: string;
  status: string;
  spend: number;
  leads: number;
  cpl: number;
  crmLeads: number;
  sales: number;
  revenue: number;
  roas: number;
  link: string;
}

const CreativosDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [sortBy, setSortBy] = useState<keyof Creative>('spend');

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period, filters.dateRange);
      const r = await axios.get('/api/dashboard/marketing/creatives', { params: { since, until } });
      setCreatives(r.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period, filters.dateRange]);

  if (error) return <ErrorScreen title="Criativos" error={error} onRetry={load} />;
  if (loading) return <LoadingScreen title="Criativos" />;

  const sorted = [...creatives].sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0));

  return (
    <Layout title="Criativos" breadcrumb={['Dashboard', 'Criativos']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Criativos" value={fmtNumber(creatives.length)} color="#0ea5e9" />
        <MiniKpi label="Investimento" value={fmtCurrency(creatives.reduce((s, c) => s + c.spend, 0))} color="#ef4444" />
        <MiniKpi label="Leads Meta" value={fmtNumber(creatives.reduce((s, c) => s + c.leads, 0))} color="#6366f1" />
        <MiniKpi label="Leads CRM" value={fmtNumber(creatives.reduce((s, c) => s + c.crmLeads, 0))} color="#8b5cf6" />
      </div>

      <CardBox title="Criativos — Campanha → Conjunto → Anúncio" right={<ExportButton filename="criativos" rows={creatives as unknown as Record<string, unknown>[]} />}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Criativo</Th>
                <Th>Conjunto</Th>
                <Th right onClick={() => setSortBy('spend')} active={sortBy === 'spend'}>Investimento</Th>
                <Th right onClick={() => setSortBy('leads')} active={sortBy === 'leads'}>Leads Meta</Th>
                <Th right onClick={() => setSortBy('crmLeads')} active={sortBy === 'crmLeads'}>Leads CRM</Th>
                <Th right onClick={() => setSortBy('cpl')} active={sortBy === 'cpl'}>CPL</Th>
                <Th right onClick={() => setSortBy('sales')} active={sortBy === 'sales'}>Vendas</Th>
                <Th right onClick={() => setSortBy('roas')} active={sortBy === 'roas'}>ROAS</Th>
                <Th>Link</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                  <Td bold>{c.name}</Td>
                  <Td>{c.adset}</Td>
                  <Td right mono>{fmtCurrency(c.spend)}</Td>
                  <Td right mono>{fmtNumber(c.leads)}</Td>
                  <Td right mono>{fmtNumber(c.crmLeads)}</Td>
                  <Td right mono>{fmtCurrency(c.cpl)}</Td>
                  <Td right mono>{fmtNumber(c.sales)}</Td>
                  <Td right mono>{fmtMult(c.roas)}</Td>
                  <Td>
                    {c.link && (
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6366f1] hover:underline whitespace-nowrap text-[12px]"
                      >
                        Ver criativo ↗
                      </a>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {creatives.length === 0 && <div className="text-center py-8 text-gray-500">Sem dados do Meta Ads no período (verifique o token em Configurações)</div>}
      </CardBox>
    </Layout>
  );
};

export default CreativosDashboard;
