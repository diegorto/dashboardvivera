import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtCurrency, fmtNumber, fmtMult, LoadingScreen, ErrorScreen, MiniKpi, CardBox, Th, Td, ExportButton } from '../utils/dashboardHelpers';
import { Campaign } from '../services/marketingDashboardService';

const CampaignsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sortBy, setSortBy] = useState<keyof Campaign>('investment');

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period);
      const r = await axios.get('/api/dashboard/marketing/campaigns', { params: { since, until } });
      setCampaigns(r.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period]);

  if (error) return <ErrorScreen title="Campanhas" error={error} onRetry={load} />;
  if (loading) return <LoadingScreen title="Campanhas" />;

  const sorted = [...campaigns].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  const totInvest = campaigns.reduce((s, c) => s + c.investment, 0);
  const totRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totLeads = campaigns.reduce((s, c) => s + c.leads, 0);

  return (
    <Layout title="Campanhas" breadcrumb={['Dashboard', 'Campanhas']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Campanhas Ativas" value={fmtNumber(campaigns.length)} color="#0ea5e9" />
        <MiniKpi label="Investimento" value={fmtCurrency(totInvest)} color="#ef4444" />
        <MiniKpi label="Receita" value={fmtCurrency(totRevenue)} color="#10b981" />
        <MiniKpi label="Leads" value={fmtNumber(totLeads)} color="#6366f1" />
      </div>

      <CardBox title="Todas as Campanhas" right={<ExportButton filename="campanhas" rows={campaigns as unknown as Record<string, unknown>[]} />}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Campanha</Th>
                <Th right onClick={() => setSortBy('investment')} active={sortBy === 'investment'}>Investimento</Th>
                <Th right onClick={() => setSortBy('leads')} active={sortBy === 'leads'}>Leads</Th>
                <Th right onClick={() => setSortBy('revenue')} active={sortBy === 'revenue'}>Receita</Th>
                <Th right onClick={() => setSortBy('roas')} active={sortBy === 'roas'}>ROAS</Th>
                <Th right onClick={() => setSortBy('revPerLead')} active={sortBy === 'revPerLead'}>R$/Lead</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                  <Td bold>{c.name}</Td>
                  <Td right mono>{fmtCurrency(c.investment)}</Td>
                  <Td right mono>{fmtNumber(c.leads)}</Td>
                  <Td right mono>{fmtCurrency(c.revenue)}</Td>
                  <Td right mono>{fmtMult(c.roas)}</Td>
                  <Td right mono>{fmtCurrency(c.revPerLead)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.length === 0 && <div className="text-center py-8 text-gray-500">Nenhuma campanha no período</div>}
      </CardBox>
    </Layout>
  );
};

export default CampaignsDashboard;
