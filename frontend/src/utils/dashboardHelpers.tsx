import React from 'react';
import { Layout } from '../components';

// ===== Datas =====
// Formata em YYYY-MM-DD usando o fuso LOCAL (nunca toISOString, que usa UTC)
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export interface PeriodRange {
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
}

/**
 * Regras de período da Vivera (semana começa no DOMINGO):
 * - today:     hoje
 * - week:      "Esta semana"    = domingo desta semana até hoje
 * - lastWeek:  "Semana passada" = domingo a sábado da semana anterior
 * - month:     "Este mês"       = dia 01 do mês corrente até hoje (PADRÃO)
 * - lastMonth: "Mês passado"    = mês anterior completo
 * - last30:    "Últimos 30 dias"
 * - year:      "Este ano"       = 01/01 até hoje
 * - custom:    range personalizado (dateRange)
 *
 * prevSince/prevUntil = mesmo período anterior equivalente, para comparação.
 */
export const getDateRange = (
  period: string,
  dateRange?: { startDate: Date; endDate: Date }
): PeriodRange => {
  const today = new Date();
  let since: Date;
  let until: Date;
  let prevSince: Date;
  let prevUntil: Date;

  switch (period) {
    case 'today':
      since = today;
      until = today;
      prevSince = addDays(today, -1);
      prevUntil = addDays(today, -1);
      break;

    case 'week': {
      // Domingo desta semana até hoje
      since = addDays(today, -today.getDay());
      until = today;
      // Mesmo trecho da semana anterior
      prevSince = addDays(since, -7);
      prevUntil = addDays(until, -7);
      break;
    }

    case 'lastWeek': {
      // Domingo a sábado da semana passada
      const thisSunday = addDays(today, -today.getDay());
      since = addDays(thisSunday, -7);
      until = addDays(thisSunday, -1);
      // Semana anterior a essa
      prevSince = addDays(since, -7);
      prevUntil = addDays(until, -7);
      break;
    }

    case 'lastMonth': {
      // Mês anterior completo
      since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      until = new Date(today.getFullYear(), today.getMonth(), 0);
      // Mês anterior a esse, completo
      prevSince = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      prevUntil = new Date(today.getFullYear(), today.getMonth() - 1, 0);
      break;
    }

    case 'last30': {
      since = addDays(today, -29);
      until = today;
      prevSince = addDays(today, -59);
      prevUntil = addDays(today, -30);
      break;
    }

    case 'year': {
      since = new Date(today.getFullYear(), 0, 1);
      until = today;
      prevSince = new Date(today.getFullYear() - 1, 0, 1);
      prevUntil = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      break;
    }

    case 'custom': {
      if (dateRange?.startDate && dateRange?.endDate) {
        since = new Date(dateRange.startDate);
        until = new Date(dateRange.endDate);
        const lenDays = Math.round((until.getTime() - since.getTime()) / 86400000) + 1;
        prevUntil = addDays(since, -1);
        prevSince = addDays(prevUntil, -(lenDays - 1));
      } else {
        // Sem range definido: cai no padrão "este mês"
        since = new Date(today.getFullYear(), today.getMonth(), 1);
        until = today;
        prevSince = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        prevUntil = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      }
      break;
    }

    case 'month':
    default: {
      // Dia 01 do mês corrente até hoje (padrão do dashboard)
      since = new Date(today.getFullYear(), today.getMonth(), 1);
      until = today;
      // Mesmo trecho do mês anterior (dia 01 até o mesmo dia; clampa no fim do mês)
      const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      prevSince = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      prevUntil = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        Math.min(today.getDate(), prevMonthLastDay)
      );
      break;
    }
  }

  return {
    since: fmtDate(since),
    until: fmtDate(until),
    prevSince: fmtDate(prevSince),
    prevUntil: fmtDate(prevUntil)
  };
};

// ===== Formatação =====
export const fmtCurrency = (v: number) =>
  v >= 1000000 || v <= -1000000
    ? `R$ ${(v / 1000000).toFixed(2)}M`
    : v >= 1000 || v <= -1000
    ? `R$ ${(v / 1000).toFixed(1)}K`
    : `R$ ${v.toFixed(0)}`;

export const fmtNumber = (v: number) => v.toLocaleString('pt-BR');
export const fmtPct = (v: number) => `${v.toFixed(1)}%`;
export const fmtMult = (v: number) => `${v.toFixed(2)}x`;

// ===== Export CSV =====
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const s = val === null || val === undefined ? '' : String(val);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => escape(r[h])).join(';'))
  ].join('\n');
  // BOM para Excel abrir acentos corretamente
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const ExportButton: React.FC<{ filename: string; rows: Record<string, unknown>[] }> = ({ filename, rows }) => (
  <button
    onClick={() => exportCsv(filename, rows)}
    disabled={rows.length === 0}
    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0] disabled:opacity-50"
  >
    ⬇ Exportar CSV
  </button>
);

// ===== Estados de tela =====
export const LoadingScreen: React.FC<{ title: string }> = ({ title }) => (
  <Layout title={title}>
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando dashboard...</p>
      </div>
    </div>
  </Layout>
);

export const ErrorScreen: React.FC<{ title: string; error: string; onRetry: () => void }> = ({ title, error, onRetry }) => (
  <Layout title={title}>
    <div className="flex items-center justify-center h-full">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dashboard</h2>
        <p className="text-red-700 mb-4">{error}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Tentar novamente
        </button>
      </div>
    </div>
  </Layout>
);

// ===== Blocos de UI =====
export const MiniKpi: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#6366f1' }) => (
  <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">{label}</div>
    <div className="text-[20px] font-bold text-[#0f172a] font-mono">{value}</div>
    <div className="h-0.5 w-8 rounded-full mt-2" style={{ backgroundColor: color }} />
  </div>
);

export const CardBox: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden mb-6">
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
      <h3 className="text-[13px] font-semibold text-[#0f172a]">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

export const Th: React.FC<{ children: React.ReactNode; right?: boolean; onClick?: () => void; active?: boolean }> = ({ children, right, onClick, active }) => (
  <th
    onClick={onClick}
    className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${onClick ? 'cursor-pointer hover:text-[#6366f1]' : ''} ${active ? 'text-[#6366f1]' : 'text-[#94a3b8]'}`}
  >
    {children}{active ? ' ↓' : ''}
  </th>
);

export const Td: React.FC<{ children: React.ReactNode; right?: boolean; mono?: boolean; bold?: boolean }> = ({ children, right, mono, bold }) => (
  <td className={`px-3 py-3 text-[12px] ${right ? 'text-right' : 'text-left'} ${mono ? 'font-mono' : ''} ${bold ? 'font-semibold text-[#0f172a]' : 'text-[#334155]'}`}>
    {children}
  </td>
);
