import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import agendaDashboardService, { AgendaKPIs, Appointment } from '../services/agendaDashboardService';
import { useAppStore } from '../stores/appStore';

const AgendaDashboard: React.FC = () => {
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<AgendaKPIs | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dayFilter, setDayFilter] = useState<'all' | 'today' | 'tomorrow'>('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await agendaDashboardService.getFullAgendaDashboard();
      setKpis(data.kpis);
      setAppointments(data.appointments);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      addNotification('error', `Erro: ${errorMessage}`);
      console.error('Erro ao carregar Agenda Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const filteredAppointments = appointments.filter(a => {
    if (dayFilter === 'today') return a.date === today;
    if (dayFilter === 'tomorrow') return a.date === tomorrow;
    return true;
  });

  const formatPct = (value: number) => `${value.toFixed(1)}%`;

  if (error) {
    return (
      <Layout title="Agenda">
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
      <Layout title="Agenda">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Agenda" breadcrumb={['Dashboard', 'Agenda']}>
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Hoje</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.today}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#0ea5e9]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Amanhã</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.tomorrow}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#6366f1]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Próximos 7 dias</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.week}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#8b5cf6]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Concluídos Hoje</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{kpis.doneToday}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#10b981]" />
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Taxa Conclusão</div>
          <div className="text-[20px] font-bold text-[#0f172a] font-mono">{formatPct(kpis.completionRate)}</div>
          <div className="h-0.5 w-8 rounded-full mt-2 bg-[#f59e0b]" />
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[13px] font-semibold text-[#0f172a]">Compromissos</h3>
          <div className="flex gap-1">
            {(['all', 'today', 'tomorrow'] as const).map(f => (
              <button
                key={f}
                onClick={() => setDayFilter(f)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                style={{
                  color: dayFilter === f ? '#ffffff' : '#64748b',
                  backgroundColor: dayFilter === f ? '#6366f1' : '#f1f5f9'
                }}
              >
                {f === 'all' ? 'Todos' : f === 'today' ? 'Hoje' : 'Amanhã'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Data</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Hora</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Compromisso</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Paciente</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Profissional</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Tipo</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appt) => (
                <tr key={appt.id} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-mono text-[#334155] whitespace-nowrap">{appt.date}</td>
                  <td className="px-3 py-3 font-mono text-[#334155] whitespace-nowrap">{appt.time || '—'}</td>
                  <td className="px-3 py-3 font-semibold text-[#0f172a]">{appt.subject || appt.dealTitle || '—'}</td>
                  <td className="px-3 py-3 text-[#334155] whitespace-nowrap">{appt.patient || '—'}</td>
                  <td className="px-3 py-3 text-[#334155] whitespace-nowrap">{appt.professional || '—'}</td>
                  <td className="px-3 py-3 text-[#334155] whitespace-nowrap">{appt.type || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: appt.done ? '#10b981' : '#f59e0b',
                        backgroundColor: appt.done ? '#dcfce7' : '#fef3c7'
                      }}
                    >
                      {appt.done ? 'Concluído' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAppointments.length === 0 && (
          <div className="text-center py-8 text-gray-500">Nenhum compromisso no período</div>
        )}
      </div>
    </Layout>
  );
};

export default AgendaDashboard;
