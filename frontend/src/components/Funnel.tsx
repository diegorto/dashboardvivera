import React from 'react';
import { ChevronDown } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';

interface FunnelStage {
  name: string;
  quantity: number;
  percentage: number;
  revenue: number;
  lostRevenue: number;
  averageTime: number;
  conversion: number;
  onClick?: () => void;
}

interface FunnelProps {
  stages: FunnelStage[];
  title?: string;
  showRevenue?: boolean;
  showTime?: boolean;
}

const Funnel: React.FC<FunnelProps> = ({
  stages,
  title = 'Funil de Conversão',
  showRevenue = true,
  showTime = true,
}) => {
  const maxQuantity = Math.max(...stages.map((s) => s.quantity));

  return (
    <div
      style={{
        backgroundColor: COLORS.neutral[0],
        borderRadius: BORDER_RADIUS.lg,
        border: `1px solid ${COLORS.neutral[200]}`,
        padding: SPACING.lg,
      }}
    >
      {title && (
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: SPACING.lg,
            color: COLORS.neutral[900],
          }}
        >
          {title}
        </h3>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
        {stages.map((stage, idx) => {
          const width = (stage.quantity / maxQuantity) * 100;

          return (
            <div
              key={idx}
              onClick={stage.onClick}
              style={{
                cursor: stage.onClick ? 'pointer' : 'default',
                transition: 'opacity 200ms',
              }}
              onMouseEnter={(e) => {
                if (stage.onClick) {
                  (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: SPACING.md,
                }}
              >
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: COLORS.neutral[900],
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.md,
                  }}
                >
                  {stage.name}
                  {idx < stages.length - 1 && <ChevronDown size={16} color={COLORS.neutral[400]} />}
                </h4>

                <div style={{ display: 'flex', gap: SPACING.xl }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', color: COLORS.neutral[500] }}>Conversão</p>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: COLORS.success[500],
                      }}
                    >
                      {stage.conversion.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Bar */}
              <div style={{ marginBottom: SPACING.md }}>
                <div
                  style={{
                    width: `${width}%`,
                    height: '32px',
                    backgroundColor: COLORS.primary[400],
                    borderRadius: BORDER_RADIUS.md,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: SPACING.md,
                    color: COLORS.neutral[0],
                    fontWeight: '600',
                    fontSize: '12px',
                  }}
                >
                  {stage.quantity.toLocaleString('pt-BR')} ({stage.percentage.toFixed(1)}%)
                </div>
              </div>

              {/* Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: SPACING.md,
                  fontSize: '12px',
                }}
              >
                <div>
                  <p style={{ color: COLORS.neutral[500] }}>Receita</p>
                  <p
                    style={{
                      color: COLORS.neutral[900],
                      fontWeight: '600',
                      marginTop: '4px',
                    }}
                  >
                    R$ {stage.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </p>
                </div>

                {showRevenue && (
                  <div>
                    <p style={{ color: COLORS.neutral[500] }}>Receita Perdida</p>
                    <p
                      style={{
                        color: COLORS.critical[500],
                        fontWeight: '600',
                        marginTop: '4px',
                      }}
                    >
                      R$ {stage.lostRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                )}

                {showTime && (
                  <div>
                    <p style={{ color: COLORS.neutral[500] }}>Tempo Médio</p>
                    <p
                      style={{
                        color: COLORS.neutral[900],
                        fontWeight: '600',
                        marginTop: '4px',
                      }}
                    >
                      {stage.averageTime} dias
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Funnel;
