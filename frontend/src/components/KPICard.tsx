import React from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  change,
  sub,
  accent = '#6366f1',
  onClick,
}) => {
  const positive = change !== undefined && change >= 0;
  const changeColor = positive ? '#10b981' : '#ef4444';
  const changePrefix = positive ? '+' : '';

  return (
    <button
      onClick={onClick}
      className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex flex-col gap-2 text-left hover:shadow-md hover:border-[#c7d2fe] transition-all group w-full"
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
        {label}
      </div>
      <div
        className="text-[22px] font-bold tracking-tight text-[#0f172a] leading-none"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      <div className="flex items-center gap-2">
        {change !== undefined && (
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: changeColor, backgroundColor: changeColor + '18' }}
          >
            {changePrefix}{change}%
          </span>
        )}
        {sub && <span className="text-[11px] text-[#94a3b8]">{sub}</span>}
      </div>
      <div
        className="h-0.5 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accent }}
      />
    </button>
  );
};

export default KPICard;
