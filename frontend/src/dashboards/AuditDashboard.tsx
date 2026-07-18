import React, { useEffect, useState } from 'react';
import tintimAuditService, { TintimAuditResponse, TintimLead } from '../services/tintimAuditService';

const AuditDashboard: React.FC = () => {
  const [data, setData] = useState<TintimAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    setLoading(true);
    const result = await tintimAuditService.getAudit();
    setData(result);
    setLoading(false);
  };

  const handleFixLead = async (leadId: string) => {
    setFixing(prev => new Set([...prev, leadId]));
    const success = await tintimAuditService.fixLead(leadId);
    if (success) {
      await loadAudit();
    }
    setFixing(prev => {
      const next = new Set(prev);
      next.delete(leadId);
      return next;
    });
  };

  const handleFixAll = async () => {
    setFixing(new Set(data?.leads.map(l => l.leadId) || []));
    for (const lead of data?.leads || []) {
      await tintimAuditService.fixLead(lead.leadId);
    }
    await loadAudit();
    setFixing(new Set());
  };

  if (loading) return <div className="p-8">Carregando auditoria Tintim...</div>;
  if (!data) return <div className="p-8">Erro ao carregar dados</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Auditoria Tintim</h1>
        <p className="text-gray-600 mt-2">Identifique leads com dados de tráfego faltando no Pipedrive</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total de Deals</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalDeals}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Faltando Tráfego</p>
          <p className="text-2xl font-bold text-red-600">{data.missingTraffic}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Escaneados</p>
          <p className="text-2xl font-bold text-gray-900">{data.scanned}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Diagnosticados</p>
          <p className="text-2xl font-bold text-gray-900">{data.diagnosed}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={handleFixAll}
          disabled={data.leads.length === 0 || fixing.size > 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
        >
          Corrigir Todos ({data.leads.length})
        </button>
        <button
          onClick={loadAudit}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
        >
          Recarregar
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {data.leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum lead com dados faltando
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nome</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Telefone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fonte/Campanha (Tintim)</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Campos Faltando</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.leads.map((lead: TintimLead) => (
                <tr key={lead.leadId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.phone}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-gray-900">
                      {lead.source && <div>📍 {lead.source}</div>}
                      {lead.campaign && <div>📢 {lead.campaign}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-red-600 text-xs">
                      {lead.missingFields?.join(', ') || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleFixLead(lead.leadId)}
                      disabled={fixing.has(lead.leadId)}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {fixing.has(lead.leadId) ? 'Corrigindo...' : 'Corrigir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditDashboard;
