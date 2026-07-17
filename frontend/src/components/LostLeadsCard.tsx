import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Objection {
  tag: string;
  count: number;
  percentage: number;
}

interface ChannelLoss {
  channel: string;
  color: string;
  lostLeads: number;
  percentage: number;
  topMotives: Array<{ motive: string; count: number; percentage: number }>;
  tags: Objection[];
}

interface LostLeadsCardProps {
  title: string;
  subtitle: string;
  totalLost: number;
  lostPercentage: number;
  lostRevenue: number;
  topObjections: Objection[];
  channels: ChannelLoss[];
  aiInsight?: string;
}

const LostLeadsCard: React.FC<LostLeadsCardProps> = ({
  title,
  subtitle,
  totalLost,
  lostPercentage,
  lostRevenue,
  topObjections,
  channels,
  aiInsight,
}) => {
  const chartData = channels.map(ch => ({
    name: ch.channel,
    value: ch.lostLeads,
  }));

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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
            {title}
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{subtitle}</p>
        </div>
        {aiInsight && (
          <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: '500', textAlign: 'right' }}>
            💡 IA Executiva - Interpretar com IA
          </div>
        )}
      </div>

      {/* Main KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #f0f4f8',
        }}
      >
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Leads perdidos
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', lineHeight: '1' }}>
            {totalLost}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            % da total de leads
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', lineHeight: '1' }}>
            {lostPercentage.toFixed(1)}%
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Receita não convertida
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', lineHeight: '1' }}>
            R$ {(lostRevenue / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Top Objections */}
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Top Objeções Globais
          </h3>
          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '12px' }}>
            Tags mais frequentes em todos os canais
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {topObjections.map((obj, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '4px 10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  color: '#0f172a',
                }}
              >
                {obj.tag} {obj.count} ({obj.percentage.toFixed(1)}%)
              </span>
            ))}
          </div>
        </div>

        {/* Channel Bar Chart */}
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Perdidos por Canal
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                width={75}
              />
              <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6 }} />
              <Bar dataKey="value" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Loss Reasons */}
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Motivos de Perda Detalhados
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
            {channels.map((channel, idx) => (
              <div key={idx}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: channel.color,
                    }}
                  />
                  {channel.channel}
                </div>
                <div style={{ fontSize: '10px', marginLeft: '14px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {channel.topMotives.map((motive, midx) => (
                    <div key={midx} style={{ color: '#64748b' }}>
                      {motive.motive}: {motive.count} ({motive.percentage.toFixed(1)}%)
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f4f8' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  CANAL
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  PERDIDOS
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  %
                </th>
                <th style={{ textAlign: 'left', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  TOP MOTIVO
                </th>
                <th style={{ textAlign: 'left', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  TAGS
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td
                    style={{
                      padding: '12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#0f172a',
                      fontWeight: '500',
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: channel.color,
                      }}
                    />
                    {channel.channel}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#ef4444', fontWeight: '600' }}>
                    {channel.lostLeads}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                    {channel.percentage.toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 0', color: '#0f172a' }}>
                    {channel.topMotives[0]?.motive || '-'}
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {channel.tags.slice(0, 2).map((tag, tidx) => (
                        <span
                          key={tidx}
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            color: '#64748b',
                          }}
                        >
                          {tag.tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <div
          style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '11px',
            color: '#0369a1',
          }}
        >
          <strong>💡 {aiInsight}</strong>
        </div>
      )}
    </div>
  );
};

export default LostLeadsCard;
