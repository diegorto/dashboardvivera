import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../styles/tokens';

interface KPICardProps {
  title: string;
  value: number | string;
  comparison?: number;
  comparisonText?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  status?: 'ok' | 'warning' | 'critical';
  tooltip?: string;
  onClick?: () => void;
  format?: 'currency' | 'percentage' | 'number';
  sparkline?: number[];
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  comparison = 0,
  comparisonText = 'vs mês anterior',
  icon,
  trend = 'stable',
  status = 'ok',
  tooltip,
  onClick,
  format = 'number',
  sparkline,
  loading = false,
}) => {
  const statusColors = {
    ok: COLORS.success[500],
    warning: COLORS.alert[500],
    critical: COLORS.critical[500],
  };

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    switch (format) {
      case 'currency':
        return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString('pt-BR');
    }
  };

  const trendIcon = {
    up: <TrendingUp size={16} color={COLORS.success[500]} />,
    down: <TrendingDown size={16} color={COLORS.critical[500]} />,
    stable: <Minus size={16} color={COLORS.neutral[400]} />,
  }[trend];

  const comparisonColor = comparison > 0 ? COLORS.success[500] : COLORS.critical[500];

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg bg-white border border-gray-200 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:border-blue-300' : ''
      }`}
      style={{
        boxShadow: SHADOWS.sm,
        borderRadius: BORDER_RADIUS.lg,
      }}
      title={tooltip}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && <div className="text-gray-400">{icon}</div>}
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        </div>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColors[status],
          }}
        />
      </div>

      {/* Main Value */}
      <div className="mb-3">
        {loading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
        )}
      </div>

      {/* Comparison */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          {trendIcon}
          <span style={{ color: comparisonColor }} className="text-sm font-semibold">
            {comparison > 0 ? '+' : ''}{comparison}%
          </span>
        </div>
        <span className="text-xs text-gray-500">{comparisonText}</span>
      </div>

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="h-8 flex items-end gap-0.5">
          {sparkline.map((val, idx) => {
            const maxVal = Math.max(...sparkline);
            const percentage = (val / maxVal) * 100;
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${percentage}%`,
                  backgroundColor: COLORS.primary[400],
                  borderRadius: BORDER_RADIUS.sm,
                  minHeight: '2px',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Drill-down Indicator */}
      {onClick && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-blue-600 font-medium">
          Clique para detalhe →
        </div>
      )}
    </div>
  );
};

export default KPICard;
