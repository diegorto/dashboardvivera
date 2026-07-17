import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CardBox, Th, Td, fmtNumber } from '../utils/dashboardHelpers';

interface SummaryData {
  success: boolean;
  stageTypes: Record<string, string>;
  totalEvents: number;
  summary: Record<string, Record<string, number>>;
}

interface DetailRow {
  personName: string;
  phone: string;
  dealId: number;
  ownerName: string;
  label: string;
  enteredAt: string;
}

const OCCURRENCE_COLS = ['1', '2', '3', '4+'];
const OCCURRENCE_LABELS: Record<string, string> = { '1': '1a vez', '2': '2a vez', '3': '3a vez', '4+': '4a vez ou mais' };

const PipelineEventsCard: React.FC = () => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState<{ eventType: string; occurrence: string; label: string } | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await axios.get('/api/dashboard/pipeline-events/summary');
      setData(r.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const openDetail = async (eventType: string, occurrence: string, label: string) => {
    setModal({ eventType, occurrence, label });
    setDetailLoading(true);
    try {
      const r = await axios.get('/api/dashboard/pipeline-events/detail', { params: { eventType, occurrence } });
      setDetailRows(r.data.rows || []);
    } catch {
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const forceSync = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/dashboard/pipeline-events/sync');
    } finally {
      setTimeout(() => setSyncing(false), 2000);
    }
  };

  if (loading && !data) {
    return (
      <CardBox title="Comparecimento, Faltas, Remarcacoes e Cancelamentos">
        <div className="text-[12px] text-[#94a3b8] py-4">Carregando...</div>
      </CardBox>
    );
  }
  if (!data) return null;

  const eventKeys = Object.keys(data.stageTypes);

  return (
    <>
      <CardBox
        title="Comparecimento, Faltas, Remarcacoes e Cancelamentos"
        right={
          <button
            onClick={forceSync}
            disabled={syncing}
            className="text-[11px] font-semibold px-2.5 py-1.5 border border-[#e2e8f0] rounded-lg text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {syncing ? 'Atualizando...' : 'Atualizar agora'}
          </button>
        }
      >
        <div className="text-[10px] text-[#94a3b8] mb-2">
          Contagem por numero da ocorrencia (historico completo, identificado por telefone) - clique num numero para ver os nomes - {fmtNumber(data.totalEvents)} eventos registrados
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <Th>Evento</Th>
                {OCCURRENCE_COLS.map(c => <Th key={c} right>{OCCURRENCE_LABELS[c]}</Th>)}
              </tr>
            </thead>
            <tbody>
              {eventKeys.map(key => (
                <tr key={key} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                  <Td bold>{data.stageTypes[key]}</Td>
                  {OCCURRENCE_COLS.map(c => {
                    const count = data.summary[key]?.[c] || 0;
                    return (
                      <Td key={c} right mono>
                        {count > 0 ? (
                          <button
                            className="text-[#6366f1] hover:underline font-semibold"
                            onClick={() => openDetail(key, c, `${data.stageTypes[key]} - ${OCCURRENCE_LABELS[c]}`)}
                          >
                            {fmtNumber(count)}
                          </button>
                        ) : (
                          <span className="text-[#cbd5e1]">0</span>
                        )}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBox>

      {modal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModal(null)} />
          <div className="relative bg-white w-full sm:w-[560px] max-w-full h-full shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#e2e8f0]">
              <h2 className="text-[15px] font-semibold text-[#0f172a]">{modal.label}</h2>
              <button onClick={() => setModal(null)} className="text-[18px] leading-none px-2.5 py-1.5 border border-[#e2e8f0] rounded-lg text-[#475569] hover:bg-[#f8fafc]" aria-label="Fechar">x</button>
            </div>
            <div className="flex-1 overflow-auto">
              {detailLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : detailRows.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[#94a3b8]">Nenhum registro</div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#f8fafc]">
                    <tr className="border-b border-[#f1f5f9]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] px-4 py-2.5">Nome</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] px-4 py-2.5">Telefone</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] px-4 py-2.5">SDR</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] px-4 py-2.5">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={i} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                        <td className="text-[12px] text-[#334155] px-4 py-2.5">{r.personName || '-'}</td>
                        <td className="text-[12px] text-[#334155] px-4 py-2.5">{r.phone || '-'}</td>
                        <td className="text-[12px] text-[#334155] px-4 py-2.5">{r.ownerName || '-'}</td>
                        <td className="text-[12px] text-[#334155] px-4 py-2.5">{r.enteredAt ? r.enteredAt.slice(0, 16).replace('T', ' ') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PipelineEventsCard;
