import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FunnelRevenue {
  pipeline: string;
  revenue: number;
  count: number;
  deals: Array<{
    id: number;
    title: string;
    value: number;
    personName: string;
    campaign: string;
  }>;
}

interface Props {
  data: FunnelRevenue[];
  loading?: boolean;
  total?: number;
}

const RevenueByFunnelCard: React.FC<Props> = ({ data, loading, total }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-200 h-20 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-3">
      {data.map(funnel => (
        <div
          key={funnel.pipeline}
          className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === funnel.pipeline ? null : funnel.pipeline)}
            className="w-full p-4 hover:bg-[#f8fafc] flex items-center justify-between text-left transition-colors"
          >
            <div className="flex-1">
              <div className="font-semibold text-[#0f172a] flex items-center gap-2">
                <span className="text-[13px] font-bold">{funnel.pipeline}</span>
                <span className="text-[11px] bg-[#dbeafe] text-[#1e40af] px-2 py-0.5 rounded-full">
                  {funnel.count} deals
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-2 text-[11px]">
                <div>
                  <span className="text-[#64748b]">Retorno</span>
                  <div className="font-bold text-[#16a34a]">{formatCurrency(funnel.revenue)}</div>
                </div>
                <div>
                  <span className="text-[#64748b]">Ticket Médio</span>
                  <div className="font-bold text-[#0f172a]">
                    {formatCurrency(funnel.count > 0 ? funnel.revenue / funnel.count : 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[#64748b]">% do Total</span>
                  <div className="font-bold text-[#0f172a]">
                    {total && total > 0 ? Math.round((funnel.revenue / total) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>
            {expanded === funnel.pipeline ? (
              <ChevronUp className="w-5 h-5 text-[#64748b]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#64748b]" />
            )}
          </button>

          {expanded === funnel.pipeline && funnel.deals.length > 0 && (
            <div className="border-t border-[#e2e8f0] p-4 bg-[#f8fafc]">
              <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-3">
                Deals Fechados ({funnel.deals.length})
              </div>
              <div className="space-y-2">
                {funnel.deals.map(deal => (
                  <div
                    key={deal.id}
                    className="bg-white p-3 rounded border border-[#e2e8f0] flex justify-between items-start text-[11px]"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-[#0f172a]">{deal.title}</div>
                      <div className="text-[#64748b] mt-1">
                        {deal.personName} • {deal.campaign}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#16a34a]">{formatCurrency(deal.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {total && (
        <div className="bg-[#f0f4f8] border border-[#e2e8f0] rounded-lg p-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-[#0f172a]">Total de Retorno</span>
            <span className="text-[14px] font-bold text-[#16a34a]">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueByFunnelCard;
