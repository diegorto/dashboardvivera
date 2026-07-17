import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components';
import PipelineEventsCard from '../components/PipelineEventsCard';
import { LoadingScreen, ErrorScreen } from '../utils/dashboardHelpers';

interface SDRMetrics {
  leadsReceived: number;
  callsMade: number;
  callsAnswered: number;
  appointments: number;
  attendances: number;
  cancellations: number;
  noShows: number;
  closingsCount: number;
  opportunitiesValue: number;
  closingsValue: number;
}

interface SDRWindowData {
  label: string;
  prevLabel: string;
  range: { since: string; until: string };
  prevRange: { since: string; until: string };
  goals: Record<string, number>;
  sdrs: {
    name: string;
    current: SDRMetrics | null;
    previous: SDRMetrics | null;
    variation: Record<string, number | null> | null;
  }[];
}

interface SDRPanel {
  today: SDRWindowData;
  week: SDRWindowData;
  month: SDRWindowData;
}

const METRIC_ROWS: { key: keyof SDRMetrics; label: string; money?: boolean; goalKey?: string }[] = [
  { key: 'leadsReceived', label: 'Leads Recebidos', goalKey: 'leadsReceived' },
  { key: 'callsMade', label: 'Ligações Realizadas', goalKey: 'callsMade' },
  { key: 'callsAnswered', label: 'Ligações Atendidas', goalKey: 'callsAnswered' },
  { key: 'appointments', label: 'Agendamentos Realizados', goalKey: 'appointments' },
  { key: 'attendances', label: 'Comparecimentos', goalKey: 'attendances' },
  { key: 'cancellations', label: 'Desmarques' },
  { key: 'noShows', label: 'Faltas' },
  { key: 'closingsCount', label: 'Fechamentos (nº)' },
  { key: 'opportunitiesValue', label: 'Oportunidades (R$)', money: true, goalKey: 'opportunitiesValue' },
  { key: 'closingsValue', label: 'Fechamentos (R$)', money: true, goalKey: 'closingsValue' },
];

const fmtVal = (v: number, money?: boolean) => {
  if (!money) return v.toLocaleString('pt-BR');
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `R$ ${Math.round(v)}`;
};

const VarBadge: React.FC<{ v: number | null | undefined }> = ({ v }) => {
  if (v === null || v === undefined) return null;
  const pos = v >= 0;
  return (
    <span
      className="ml-1 text-[9px] font-semibold px-1 py-0.5 rounded"
      style={{ color: pos ? '#10b981' : '#ef4444', backgroundColor: (pos ? '#10b981' : '#ef4444') + '15' }}
    >
      {pos ? '+' : ''}{v}%
    </span>
  );
};

const WindowCard: React.FC<{ data: SDRWindowData }> = ({ data }) => {
  const fmtBR = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-bold text-[#0f172a]">{data.label}</h3>
        <span className="text-[10px] text-[#94a3b8]">
          {fmtBR(data.range.since)} – {fmtBR(data.range.until)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#f1f5f9]">
              <th className="text-left text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8] px-2 py-2">Métrica</th>
              {data.sdrs.map(s => (
                <th
                  key={s.name}
                  className="text-right text-[9px] font-semibold uppercase tracking-wider px-2 py-2"
                  style={{ color: s.name === 'Agda' ? '#e11d48' : '#4f46e5' }}
                >
                  {s.name}
                </th>
              ))}
              <th className="text-right text-[9px] font-semibold uppercase tracking-wider text-[#0f172a] px-2 py-2">Meta</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map(row => (
              <tr key={row.key} className="border-b border-[#f8fafc]">
                <td className="text-[11px] text-[#334155] font-medium px-2 py-2 whitespace-nowrap">{row.label}</td>
                {data.sdrs.map(s => (
                  <td
                    key={s.name}
                    className="text-right text-[11px] font-semibold font-mono px-2 py-2 whitespace-nowrap"
                    style={{ backgroundColor: s.name === 'Agda' ? '#fff1f2' : '#eef2ff' }}
                  >
                    {s.current ? fmtVal(s.current[row.key], row.money) : '-'}
                    {s.variation && <VarBadge v={s.variation[row.key]} />}
                  </td>
                ))}
                <td className="text-right text-[11px] font-bold font-mono text-[#0f172a] px-2 py-2">
                  {row.goalKey && data.goals[row.goalKey] !== undefined
                    ? fmtVal(data.goals[row.goalKey], row.money)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-[#cbd5e1] mt-2">
        Comparação: {data.prevLabel} ({fmtBR(data.prevRange.since)} – {fmtBR(data.prevRange.until)})
      </div>
    </div>
  );
};

const SDRsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<SDRPanel | null>(null);
  const [bizDays, setBizDays] = useState<number>(0);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await axios.get('/api/dashboard/sdr-panel');
      setPanel(r.data.data);
      setBizDays(r.data.businessDaysInMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar painel SDR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <ErrorScreen title="SDRs" error={error} onRetry={load} />;
  if (loading || !panel) return <LoadingScreen title="SDRs" />;

  return (
    <Layout title="Painel SDR" breadcrumb={['Dashboard', 'SDRs']}>
      <div className="mb-4 text-[11px] text-[#64748b]">
        Metas semanais = meta diária × 5 dias úteis · Metas mensais = meta diária × <b>{bizDays} dias úteis</b> deste mês (seg–sex)
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <WindowCard data={panel.today} />
        <WindowCard data={panel.week} />
        <WindowCard data={panel.month} />
      </div>

      <div className="mt-4">
        <PipelineEventsCard />
      </div>

      <div className="mt-4 text-[10px] text-[#94a3b8]">
        * Desmarques passam a contar automaticamente quando o tipo de atividade "Desmarcou" for criado no Pipedrive.
        Ligações Realizadas = tentativas + atendidas. Oportunidades = valor dos negócios criados pelos leads da SDR no período.
        Fechamentos por data de ganho. Atualiza sozinho a cada 5 minutos.
      </div>
    </Layout>
  );
};

export default SDRsDashboard;
