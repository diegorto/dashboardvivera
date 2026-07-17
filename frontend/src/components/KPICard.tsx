import React from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  sub?: string;
  accent?: string;
  onClick?: () => void;
  progress?: number; // 0-100 for progress bar (e.g., goal achievement)
  progressLabel?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  change,
  sub,
  accent = '#6366f1',
  onClick,
  progress,
  progressLabel,
}) => {
  const positive = change !== undefined && change >= 0;
  const changeColor = positive ? '#10b981' : '#ef4444';
  const changePrefix = positive ? '+' : '';

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-all hover:shadow-lg"
      style={{
        background: '#ffffff',
        border: '1px solid #f0f4f8',
        borderRadius: '8px',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: '500',
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px',
        }}
      >
        {label}
      </div>

      {/* Main Value */}
      <div
        style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#0f172a',
          marginBottom: '8px',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: '1',
        }}
      >
        {value}
      </div>

      {/* Progress bar (for goal/meta) */}
      {progress !== undefined && (
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
              fontSize: '11px',
            }}
          >
            <span style={{ color: '#94a3b8' }}>{progressLabel || 'Progresso'}</span>
            <span
              style={{
                fontWeight: '600',
                color: progress >= 80 ? '#10b981' : progress >= 60 ? '#f59e0b' : '#ef4444',
              }}
            >
              R$ {(progress * 0.01 * 350000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({Math.round(progress)}%)
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e2e8f0',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                backgroundColor:
                  progress >= 80
                    ? '#10b981'
                    : progress >= 60
                    ? '#f59e0b'
                    : '#ef4444',
                transition: 'width 300ms ease-in-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Change + Sub Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {change !== undefined && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: changeColor,
            }}
          >
            {changePrefix}{change}%
          </span>
        )}
        {sub && (
          <span
            style={{
              fontSize: '11px',
              color: '#94a3b8',
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </button>
  );
};

export default KPICard;
