import React from 'react';
import { DrillDownState } from '../hooks/useDrillDown';

interface DrillDownDrawerProps {
  drillDown: DrillDownState;
  onClose: () => void;
}

const ExecutiveDrillDownDrawer: React.FC<DrillDownDrawerProps> = ({ drillDown, onClose }) => {
  if (!drillDown.type) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg overflow-y-auto z-50 transform transition-transform duration-300"
        style={{
          transform: drillDown.type ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#e2e8f0] p-6 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-[#0f172a]">
            {drillDown.title || 'Detalhes'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {drillDown.type === 'leads-total' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#94a3b8] mb-2">Período</h3>
                <p className="text-base text-[#0f172a]">{drillDown.data?.period}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#94a3b8] mb-2">Total de Leads</h3>
                <p className="text-3xl font-bold text-[#6366f1]">
                  {drillDown.data?.totalLeads?.toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#94a3b8] mb-2">Leads Qualificados</h3>
                <p className="text-2xl font-bold text-[#10b981]">
                  {drillDown.data?.qualifiedLeads?.toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#94a3b8] mb-2">Taxa de Qualificação</h3>
                <p className="text-2xl font-bold text-[#0ea5e9]">
                  {drillDown.data?.qualificationRate?.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {drillDown.type === 'leads-by-source' && (
            <div className="space-y-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="text-left py-2 text-[#94a3b8] font-semibold">Fonte</th>
                    <th className="text-right py-2 text-[#94a3b8] font-semibold">Leads</th>
                    <th className="text-right py-2 text-[#94a3b8] font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDown.data?.map((source: any, idx: number) => (
                    <tr key={idx} className="border-b border-[#f8fafc]">
                      <td className="py-3 text-[#0f172a]">{source.source}</td>
                      <td className="py-3 text-right text-[#0f172a] font-semibold">
                        {source.leads.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 text-right text-[#0f172a] font-semibold">
                        {source.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {drillDown.type === 'sales-by-funnel' && (
            <div className="space-y-4">
              {drillDown.data?.map((funnel: any, idx: number) => (
                <div
                  key={idx}
                  className="border border-[#e2e8f0] rounded-lg p-4"
                  style={{ borderLeftWidth: '4px', borderLeftColor: funnel.color }}
                >
                  <h4 className="font-semibold text-[#0f172a] mb-2">{funnel.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-[#94a3b8]">Receita</span>
                      <p className="font-semibold text-[#0f172a]">
                        R$ {(funnel.revenue / 1000).toFixed(0)}K
                      </p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8]">Vendas</span>
                      <p className="font-semibold text-[#0f172a]">{funnel.sales}</p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8]">Ticket Médio</span>
                      <p className="font-semibold text-[#0f172a]">
                        R$ {funnel.avgTicket.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8]">% da Receita</span>
                      <p className="font-semibold text-[#0f172a]">{funnel.revenuePercentage.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === 'conversion-time-channel' && (
            <div className="space-y-4">
              {drillDown.data?.map((channel: any, idx: number) => (
                <div key={idx} className="border border-[#e2e8f0] rounded-lg p-4">
                  <h4 className="font-semibold text-[#0f172a] mb-2">{channel.name}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">Tempo médio</span>
                      <span className="font-semibold text-[#0f172a]">{channel.time.toFixed(1)} dias</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === 'no-shows-sdr' && (
            <div className="space-y-3">
              {drillDown.data?.map((sdr: any, idx: number) => (
                <div key={idx} className="border border-[#e2e8f0] rounded-lg p-3">
                  <p className="font-semibold text-[#0f172a]">{sdr.name}</p>
                  <div className="text-sm text-[#94a3b8] mt-1">
                    <p>Faltas/Cancelamentos: {sdr.value}</p>
                    <p>Percentual: {sdr.percentage.toFixed(1)}%</p>
                    {sdr.revenue && <p>Impacto: R$ {(sdr.revenue / 1000).toFixed(0)}K</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === 'response-speed-sdr' && (
            <div className="space-y-3">
              {drillDown.data?.map((sdr: any, idx: number) => (
                <div key={idx} className="border border-[#e2e8f0] rounded-lg p-3">
                  <p className="font-semibold text-[#0f172a]">{sdr.name}</p>
                  <div className="text-sm space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Tempo médio de resposta:</span>
                      <span className="font-semibold text-[#0f172a]">{sdr.avgResponseTime.toFixed(1)} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Qualificação:</span>
                      <span
                        className="font-semibold"
                        style={{ color: sdr.qualificationRate >= 60 ? '#10b981' : '#f59e0b' }}
                      >
                        {sdr.qualificationRate}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === 'lost-leads-channel' && (
            <div className="space-y-3">
              {drillDown.data?.map((channel: any, idx: number) => (
                <div key={idx} className="border border-[#e2e8f0] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <p className="font-semibold text-[#0f172a]">{channel.channel}</p>
                  </div>
                  <div className="text-sm text-[#94a3b8]">
                    <p>Leads Perdidos: {channel.lostLeads}</p>
                    <p>Percentual: {channel.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {drillDown.type === 'lost-leads-objection' && (
            <div className="space-y-3">
              {drillDown.data?.map((objection: any, idx: number) => (
                <div key={idx} className="border border-[#e2e8f0] rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-[#0f172a]">{objection.tag}</p>
                    <span className="text-sm font-bold text-[#ef4444]">{objection.count}</span>
                  </div>
                  <p className="text-sm text-[#94a3b8] mt-1">{objection.percentage.toFixed(1)}% das objeções</p>
                </div>
              ))}
            </div>
          )}

          {!drillDown.data && (
            <div className="text-center py-8">
              <p className="text-gray-500">Sem dados disponíveis</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ExecutiveDrillDownDrawer;
