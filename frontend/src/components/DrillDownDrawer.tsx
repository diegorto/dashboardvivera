import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { exportCsv } from '../utils/dashboardHelpers';

interface Column {
  key: string;
  label: string;
}

interface DrillDownData {
  title: string;
  columns: Column[];
  rows: Record<string, string | number>[];
}

interface DrillDownDrawerProps {
  metric: string;
  since: string;
  until: string;
  onClose: () => void;
}

const MONEY_KEYS = ['valor', 'receita', 'investimento'];

const DrillDownDrawer: React.FC<DrillDownDrawerProps> = ({ metric, since, until, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DrillDownData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await axios.get('/api/dashboard/executive/drilldown', {
          params: { metric, since, until }
        });
        setData(r.data.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar detalhes');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [metric, since, until]);

  const fmtCell = (key: string, v: string | number) => {
    if (MONEY_KEYS.includes(key) && typeof v === 'number') {
      return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return v;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-white w-full sm:w-[640px] max-w-full h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#e2e8f0]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
              Drill-down · {since.split('-').reverse().join('/')} – {until.split('-').reverse().join('/')}
            </div>
            <h2 className="text-[15px] font-semibold text-[#0f172a] mt-1">
              {data?.title || 'Carregando...'}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data && data.rows.length > 0 && (
              <button
                onClick={() => exportCsv(`drilldown-${metric}`, data.rows)}
                className="text-[11px] font-semibold px-2.5 py-1.5 border border-[#e2e8f0] rounded-lg text-[#475569] hover:bg-[#f8fafc]"
              >
                CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="text-[18px] leading-none px-2.5 py-1.5 border border-[#e2e8f0] rounded-lg text-[#475569] hover:bg-[#f8fafc]"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-5 text-[13px] text-red-600">{error}</div>
          )}

          {!loading && !error && data && (
            data.rows.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#94a3b8]">
                Nenhum registro no período selecionado
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-[#f8fafc]">
                  <tr className="border-b border-[#f1f5f9]">
                    {data.columns.map(c => (
                      <th
                        key={c.key}
                        className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] px-4 py-2.5 whitespace-nowrap"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-[#f8fafc] hover:bg-[#f8fafc]">
                      {data.columns.map(c => (
                        <td key={c.key} className="text-[12px] text-[#334155] px-4 py-2.5 align-top">
                          {c.key === 'link' ? (
                            row[c.key] ? (
                              <a
                                href={String(row[c.key])}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#6366f1] hover:underline whitespace-nowrap"
                              >
                                Ver criativo ↗
                              </a>
                            ) : (
                              <span className="text-[#cbd5e1]">—</span>
                            )
                          ) : (
                            <span className={MONEY_KEYS.includes(c.key) ? 'font-mono font-semibold' : ''}>
                              {fmtCell(c.key, row[c.key])}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default DrillDownDrawer;
