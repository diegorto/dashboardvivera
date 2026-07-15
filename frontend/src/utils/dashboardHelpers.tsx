import React from 'react';
import { Layout } from '../components';

// ===== Datas =====
export const getDateRange = (period: string) => {
  const until = new Date();
  const since = new Date();
  switch (period) {
    case 'today':
      break;
    case 'week':
      since.setDate(since.getDate() - 7);
      break;
    case 'year':
      since.setFullYear(since.getFullYear() - 1);
      break;
    case 'month':
    default:
      since.setDate(since.getDate() - 30);
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
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
