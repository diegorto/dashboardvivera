import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components';
import { useFilters } from '../contexts/FilterContext';
import { getDateRange, fmtCurrency, fmtNumber, LoadingScreen, ErrorScreen, MiniKpi, CardBox, Th, Td, ExportButton } from '../utils/dashboardHelpers';

interface Patient {
  id: number;
  name: string;
  email: string;
  status: string;
  value: number;
  origem: string;
  campanha: string;
  owner: string;
  addDate: string;
  lostReason: string;
}

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Em andamento', color: '#0ea5e9', bg: '#e0f2fe' },
  won: { label: 'Cliente', color: '#10b981', bg: '#dcfce7' },
  lost: { label: 'Perdido', color: '#ef4444', bg: '#fee2e2' }
};

const PatientsDashboard: React.FC = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'won' | 'lost'>('all');

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const { since, until } = getDateRange(filters.period, filters.dateRange);
      const r = await axios.get('/api/dashboard/patients', { params: { since, until } });
      setPatients(r.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.period, filters.dateRange]);

  if (error) return <ErrorScreen title="Pacientes" error={error} onRetry={load} />;
  if (loading) return <LoadingScreen title="Pacientes" />;

  const filtered = patients.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search && !`${p.name} ${p.email} ${p.campanha}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Layout title="Pacientes" breadcrumb={['Dashboard', 'Pacientes']}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Total no Período" value={fmtNumber(patients.length)} color="#0ea5e9" />
        <MiniKpi label="Em Andamento" value={fmtNumber(patients.filter(p => p.status === 'open').length)} color="#6366f1" />
        <MiniKpi label="Clientes" value={fmtNumber(patients.filter(p => p.status === 'won').length)} color="#10b981" />
        <MiniKpi label="Perdidos" value={fmtNumber(patients.filter(p => p.status === 'lost').length)} color="#ef4444" />
      </div>

      <CardBox
        title={`Pacientes (${filtered.length})`}
        right={
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nome, email, campanha..."
              className="text-[12px] border border-[#e2e8f0] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#6366f1] w-56"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-[12px] border border-[#e2e8f0] rounded-lg px-2 py-1.5"
            >
              <option value="all">Todos</option>
              <option value="open">Em andamento</option>
              <option value="won">Clientes</option>
              <option value="lost">Perdidos</option>
            </select>
            <ExportButton filename="pacientes" rows={filtered as unknown as Record<string, unknown>[]} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Paciente</Th>
                <Th>Status</Th>
                <Th right>Valor</Th>
                <Th>Origem</Th>
                <Th>Campanha</Th>
                <Th>Responsável</Th>
                <Th>Entrada</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(p => {
                const st = statusLabel[p.status] || { label: p.status, color: '#64748b', bg: '#f1f5f9' };
                return (
                  <tr key={p.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                    <Td bold>{p.name}</Td>
                    <Td>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>
                        {st.label}
                      </span>
                    </Td>
                    <Td right mono>{fmtCurrency(p.value)}</Td>
                    <Td>{p.origem || '—'}</Td>
                    <Td>{p.campanha || '—'}</Td>
                    <Td>{p.owner || '—'}</Td>
                    <Td mono>{p.addDate}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && <div className="text-center py-3 text-[11px] text-gray-400">Mostrando 200 de {filtered.length} — use a busca ou exporte o CSV completo</div>}
        {filtered.length === 0 && <div className="text-center py-8 text-gray-500">Nenhum paciente encontrado</div>}
      </CardBox>
    </Layout>
  );
};

export default PatientsDashboard;
