import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ChannelTime {
  name: string;
  time: number; // em dias
  color: string;
}

interface ConversionTimeCardProps {
  icon?: string;
  number?: string;
  title: string;
  subtitle: string;
  totalTime: number; // em dias
  bestChannel?: string;
  improvement?: number; // percentual
  improvementText?: string;
  channels: ChannelTime[];
  monthlyEvolution?: Array<{ month: string; time: number }>;
  additionalMetrics?: Array<{
    label: string;
    value: string | number;
    color?: string;
  }>;
  aiInsight?: string;
}

const ConversionTimeCard: React.FC<ConversionTimeCardProps> = ({
  icon,
  number,
  title,
  subtitle,
  totalTime,
  bestChannel,
  improvement,
  improvementText,
  channels,
  monthlyEvolution,
  additionalMetrics,
  aiInsight,
}) => {
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

      {/* Main Time */}
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <div
          style={{
            fontSize: '36px',
            fontWeight: '700',
            color: '#6366f1',
            lineHeight: '1',
            marginBottom: '4px',
          }}
        >
          {totalTime.toFixed(1)}d
        </div>
        {bestChannel && improvement !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Melhor canal: {bestChannel}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#10b981',
                backgroundColor: '#f0fdf4',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {improvement > 0 ? '-' : '+'}{Math.abs(improvement)}% {improvementText}
            </span>
          </div>
        )}
      </div>

      {/* Metrics Boxes */}
      {additionalMetrics && additionalMetrics.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(3, additionalMetrics.length)}, 1fr)`,
            gap: '8px',
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid #f0f4f8',
          }}
        >
          {additionalMetrics.map((metric, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: metric.color ? metric.color + '10' : '#f8fafc',
                border: `1px solid ${metric.color ? metric.color + '20' : '#f0f4f8'}`,
                borderRadius: '6px',
                padding: '8px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  marginBottom: '2px',
                }}
              >
                {metric.label}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: metric.color || '#0f172a',
                }}
              >
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Channels Comparison */}
      {channels.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '500' }}>
            Comparativo por canal
          </div>
          <div style={{ display: 'space-y-2' }}>
            {channels.map((channel, idx) => (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '11px',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#0f172a',
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
                    {channel.name}
                  </span>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>
                    {channel.time.toFixed(1)}d
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#f0f4f8',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(channel.time / Math.max(...channels.map(c => c.time))) * 100}%`,
                      backgroundColor: channel.color,
                      transition: 'width 300ms ease-in-out',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Evolution Chart */}
      {monthlyEvolution && monthlyEvolution.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={monthlyEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  backgroundColor: '#ffffff',
                }}
              />
              <Line
                type="monotone"
                dataKey="time"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
              fontSize: '11px',
              fontWeight: '600',
              color: '#0369a1',
              marginBottom: '4px',
            }}
          >
            💡 Interpretação IA
          </div>
          <div style={{ fontSize: '10px', color: '#0369a1', lineHeight: '1.4' }}>
            {aiInsight}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversionTimeCard;
