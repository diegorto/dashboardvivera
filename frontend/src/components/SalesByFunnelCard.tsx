import React from 'react';

interface FunnelData {
  name: string;
  color: string;
  revenue: number;
  revenuePercentage: number;
  sales: number;
  avgTicket: number;
  change: number;
  leads: number;
  qualified: number;
  conversionRate: number;
}

interface SalesByFunnelCardProps {
  title: string;
  period: string;
  totalRevenue: number;
  totalSales: number;
  avgTicket: number;
  funnels: FunnelData[];
}

const SalesByFunnelCard: React.FC<SalesByFunnelCardProps> = ({
  title,
  period,
  totalRevenue,
  totalSales,
  avgTicket,
  funnels,
}) => {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return `R$ ${value}`;
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f4f8',
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
          {title}
        </h2>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>{period}</p>
      </div>

      {/* Total Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #f0f4f8',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Receita total
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
            {formatCurrency(totalRevenue)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Vendas fechadas
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
            {totalSales}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Ticket médio geral
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#6366f1' }}>
            {formatCurrency(avgTicket)}
          </div>
        </div>
      </div>

      {/* Funnels Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        {funnels.map((funnel, idx) => (
          <div
            key={idx}
            style={{
              border: `1px solid ${funnel.color}20`,
              borderRadius: '8px',
              padding: '16px',
              backgroundColor: funnel.color + '05',
            }}
          >
            {/* Funnel Name with Icon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: funnel.color,
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                {funnel.name}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#10b981',
                  marginLeft: 'auto',
                }}
              >
                {funnel.change >= 0 ? '+' : ''}{funnel.change}%
              </span>
            </div>

            {/* Revenue */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                Receita
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: funnel.color }}>
                {formatCurrency(funnel.revenue)}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                {funnel.revenuePercentage}% do total
              </div>
            </div>

            {/* Sales & Ticket */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f0f4f8',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
                  Vendas
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  {funnel.sales}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
                  Ticket
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  {formatCurrency(funnel.avgTicket)}
                </div>
              </div>
            </div>

            {/* Leads Metrics */}
            <div style={{ fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#94a3b8' }}>Leads</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{funnel.leads}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#94a3b8' }}>Qualif.</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>{funnel.qualified}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '4px',
                  borderTop: '1px solid #f0f4f8',
                  color: '#94a3b8',
                }}
              >
                <span>Conv.</span>
                <span style={{ fontWeight: '600', color: '#6366f1' }}>
                  {funnel.conversionRate}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalesByFunnelCard;
