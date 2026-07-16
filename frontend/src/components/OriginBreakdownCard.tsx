import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

interface Origin {
  origem: string;
  leads: number;
  won: number;
  conversionRate: string;
  revenue: number;
  investment: number;
  roas: string;
  deals: Array<{
    id: number;
    title: string;
    value: number;
    status: string;
    stage: string;
    wonDate: string;
  }>;
}

interface Props {
  data: Origin[];
  loading?: boolean;
}

const OriginBreakdownCard: React.FC<Props> = ({ data, loading }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-200 h-24 rounded-lg animate-pulse" />
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
      {data.map(origin => (
        <div
          key={origin.origem}
          className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === origin.origem ? null : origin.origem)}
            className="w-full p-4 hover:bg-[#f8fafc] flex items-center justify-between text-left transition-colors"
          >
            <div className="flex-1">
              <div className="font-semibold text-[#0f172a] flex items-center gap-2">
                <span className="text-[13px] font-bold">{origin.origem}</span>
                <span className="text-[11px] bg-[#dbeafe] text-[#1e40af] px-2 py-0.5 rounded-full">
                  {origin.leads} leads
                </span>
              </div>
              <div className="grid grid-cols-5 gap-4 mt-2 text-[11px]">
                <div>
                  <span className="text-[#64748b]">Conversão</span>
                  <div className="font-bold text-[#0f172a]">{origin.conversionRate}%</div>
                </div>
                <div>
                  <span className="text-[#64748b]">Vendas</span>
                  <div className="font-bold text-[#0f172a]">{origin.won}</div>
                </div>
                <div>
                  <span className="text-[#64748b]">Investimento</span>
                  <div className="font-bold text-[#0f172a]">{formatCurrency(origin.investment)}</div>
                </div>
                <div>
                  <span className="text-[#64748b]">Retorno</span>
                  <div className="font-bold text-[#16a34a]">{formatCurrency(origin.revenue)}</div>
                </div>
                <div>
                  <span className="text-[#64748b]">ROAS</span>
                  <div className="font-bold text-[#0f172a] flex items-center gap-1">
                    {origin.roas}
                    <TrendingUp className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
            {expanded === origin.origem ? (
              <ChevronUp className="w-5 h-5 text-[#64748b]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#64748b]" />
            )}
          </button>

          {expanded === origin.origem && origin.deals.length > 0 && (
            <div className="border-t border-[#e2e8f0] p-4 bg-[#f8fafc]">
              <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-3">
                Deals Fechados ({origin.deals.length})
              </div>
              <div className="space-y-2">
                {origin.deals.map(deal => (
                  <div
                    key={deal.id}
                    className="bg-white p-3 rounded border border-[#e2e8f0] flex justify-between items-start text-[11px]"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-[#0f172a]">{deal.title}</div>
                      <div className="text-[#64748b] mt-1">
                        {deal.stage} • {deal.wonDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#16a34a]">{formatCurrency(deal.value)}</div>
                      <div className="text-[#64748b]">{deal.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default OriginBreakdownCard;
