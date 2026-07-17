import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SDRMetric {
  name: string;
  value: number;
  percentage: number;
  revenue?: number;
}

interface DayData {
  day: string;
  count: number;
}

interface RecentItem {
  name: string;
  date: string;
  time?: string;
  reason?: string;
  revenue: number;
  status?: 'Reagendado' | 'Perdido' | 'Agendado';
  observation?: string;
}

interface NoShowCancellationCardProps {
  icon?: string;
  number?: string;
  title: string;
  subtitle: string;
  totalCount: number;
  percentage: number;
  revenue: number;
  change: number; // percentual
  metrics: SDRMetric[];
  dayData?: DayData[];
  motives?: Array<{ label: string; count: number; percentage: number }>;
  recentItems: RecentItem[];
  motivesTitle?: string;
  aiInsight?: string;
  showMotives?: boolean;
}

const NoShowCancellationCard: React.FC<NoShowCancellationCardProps> = ({
  icon,
  number,
  title,
  subtitle,
  totalCount,
  percentage,
  revenue,
  change,
  metrics,
  dayData,
  motives,
  recentItems,
  motivesTitle = 'Motivos de cancelamento',
  aiInsight,
  showMotives = true,
}) => {
  const changeColor = change >= 0 ? '#ef4444' : '#10b981';
  const changePrefix = change >= 0 ? '+' : '';

  const maxMetricValue = Math.max(...metrics.map(m => m.value));

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f4f8',
        borderRadius: '8px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'start', gap: '12px' }}>
        {icon && (
          <div
            style={{
              fontSize: '20px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {number && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#94a3b8',
                  backgroundColor: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                {number}
              </span>
            )}
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
              {title}
            </h3>
          </div>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{subtitle}</p>
        </div>
      </div>

      {/* Main Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #f0f4f8',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
            Total
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>
            {totalCount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
            Taxa
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>
            {percentage.toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
            Em risco
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              {revenue > 1000 ? `R$ ${(revenue / 1000).toFixed(0)}K` : `R$ ${revenue}`}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '600',
                color: changeColor,
              }}
            >
              {changePrefix}{change}pp vs mês
            </span>
          </div>
        </div>
      </div>

      {/* SDR Metrics Table */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
          Por SDR
        </div>
        <div style={{ fontSize: '11px' }}>
          {metrics.map((metric, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ color: '#0f172a', fontWeight: '500' }}>{metric.name}</span>
                <span
                  style={{
                    color: '#0f172a',
                    fontWeight: '600',
                  }}
                >
                  {metric.value}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '4px',
                    backgroundColor: '#f0f4f8',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(metric.value / maxMetricValue) * 100}%`,
                      backgroundColor: '#ef4444',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: '#94a3b8', minWidth: '35px', textAlign: 'right' }}>
                  {metric.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day Chart */}
      {dayData && dayData.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
            Faltas por dia da semana
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6 }} />
              <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Motives */}
      {showMotives && motives && motives.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
            {motivesTitle}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {motives.map((motive, idx) => (
              <div
                key={idx}
                style={{
                  flex: '1 1 calc(50% - 4px)',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f0f4f8',
                  borderRadius: '6px',
                  padding: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                  {motive.count}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{motive.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Items */}
      <div style={{ marginBottom: '8px', borderTop: '1px solid #f0f4f8', paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
          Últimas
        </div>
        <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
          {recentItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: idx < recentItems.length - 1 ? '1px solid #f8fafc' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: '4px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {item.date}
                    {item.time && ` ${item.time}`}
                  </div>
                </div>
                {item.status && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor:
                        item.status === 'Reagendado'
                          ? '#f0fdf4'
                          : item.status === 'Perdido'
                          ? '#fef2f2'
                          : '#f0f9ff',
                      color:
                        item.status === 'Reagendado'
                          ? '#10b981'
                          : item.status === 'Perdido'
                          ? '#ef4444'
                          : '#0369a1',
                    }}
                  >
                    {item.status}
                  </span>
                )}
              </div>
              {item.reason && (
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                  {item.reason}
                </div>
              )}
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f172a' }}>
                {item.revenue > 1000 ? `R$ ${(item.revenue / 1000).toFixed(1)}K` : `R$ ${item.revenue}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <div
          style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '10px',
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#0369a1',
            }}
          >
            💡 {aiInsight}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoShowCancellationCard;
