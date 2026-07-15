import React from 'react';
import { AlertCircle, TrendingUp, Target, Zap } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';

interface InsightCard {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

interface AIInsightProps {
  insights: InsightCard[];
  loading?: boolean;
}

const AIInsight: React.FC<AIInsightProps> = ({ insights, loading = false }) => {
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: COLORS.neutral[0],
          borderRadius: BORDER_RADIUS.lg,
          border: `1px solid ${COLORS.neutral[200]}`,
          padding: SPACING.lg,
        }}
      >
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: SPACING.lg,
            color: COLORS.neutral[900],
          }}
        >
          🤖 Inteligência IA
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: SPACING.lg }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: '100px', backgroundColor: COLORS.neutral[200], borderRadius: BORDER_RADIUS.md, animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: COLORS.neutral[0],
        borderRadius: BORDER_RADIUS.lg,
        border: `1px solid ${COLORS.neutral[200]}`,
        padding: SPACING.lg,
      }}
    >
      <h3
        style={{
          fontSize: '16px',
          fontWeight: '600',
          marginBottom: SPACING.lg,
          color: COLORS.neutral[900],
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        🤖 Inteligência IA
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: SPACING.lg }}>
        {insights.map((insight, idx) => (
          <div
            key={idx}
            onClick={insight.onClick}
            style={{
              backgroundColor: insight.color,
              borderRadius: BORDER_RADIUS.md,
              padding: SPACING.lg,
              cursor: insight.onClick ? 'pointer' : 'default',
              transition: 'all 200ms ease-in-out',
              border: `2px solid ${insight.color}`,
              opacity: 0.9,
            }}
            onMouseEnter={(e) => {
              if (insight.onClick) {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.opacity = '0.9';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
            }}
          >
            <div style={{ marginBottom: SPACING.md }}>{insight.icon}</div>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: COLORS.neutral[0],
                marginBottom: SPACING.sm,
              }}
            >
              {insight.title}
            </h4>
            <p
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: COLORS.neutral[0],
                marginBottom: SPACING.sm,
              }}
            >
              {insight.value}
            </p>
            {insight.description && (
              <p
                style={{
                  fontSize: '12px',
                  color: COLORS.neutral[0],
                  opacity: 0.9,
                  lineHeight: '1.4',
                }}
              >
                {insight.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIInsight;

// Helper component for simple insight panel (O que? Por quê? Impacto? Ação? Prioridade?)
export const AIInsightPanel: React.FC<{
  whatHappened: string;
  why: string;
  financialImpact: number;
  recommendedAction: string;
  priority: 'high' | 'medium' | 'low';
}> = ({ whatHappened, why, financialImpact, recommendedAction, priority }) => {
  const priorityColors = {
    high: COLORS.critical[50],
    medium: COLORS.alert[50],
    low: COLORS.success[50],
  };

  const priorityBorders = {
    high: COLORS.critical[500],
    medium: COLORS.alert[500],
    low: COLORS.success[500],
  };

  const priorityLabels = {
    high: 'Alta Prioridade',
    medium: 'Média Prioridade',
    low: 'Baixa Prioridade',
  };

  return (
    <div
      style={{
        backgroundColor: priorityColors[priority],
        border: `2px solid ${priorityBorders[priority]}`,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          marginBottom: SPACING.lg,
        }}
      >
        <AlertCircle size={20} color={priorityBorders[priority]} />
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: priorityBorders[priority],
          }}
        >
          {priorityLabels[priority]}
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg, marginBottom: SPACING.lg }}>
        {/* O que aconteceu? */}
        <div>
          <p style={{ fontSize: '12px', color: COLORS.neutral[600], fontWeight: '600', marginBottom: SPACING.sm }}>
            O que aconteceu?
          </p>
          <p style={{ fontSize: '14px', color: COLORS.neutral[900], lineHeight: '1.5' }}>{whatHappened}</p>
        </div>

        {/* Por quê? */}
        <div>
          <p style={{ fontSize: '12px', color: COLORS.neutral[600], fontWeight: '600', marginBottom: SPACING.sm }}>
            Por quê?
          </p>
          <p style={{ fontSize: '14px', color: COLORS.neutral[900], lineHeight: '1.5' }}>{why}</p>
        </div>

        {/* Impacto financeiro */}
        <div>
          <p style={{ fontSize: '12px', color: COLORS.neutral[600], fontWeight: '600', marginBottom: SPACING.sm }}>
            Impacto Financeiro
          </p>
          <p style={{ fontSize: '18px', fontWeight: '700', color: priorityBorders[priority] }}>
            R$ {financialImpact.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Ação recomendada */}
        <div>
          <p style={{ fontSize: '12px', color: COLORS.neutral[600], fontWeight: '600', marginBottom: SPACING.sm }}>
            Ação Recomendada
          </p>
          <p style={{ fontSize: '14px', color: COLORS.neutral[900], lineHeight: '1.5' }}>{recommendedAction}</p>
        </div>
      </div>

      <button
        style={{
          width: '100%',
          padding: `${SPACING.md} ${SPACING.lg}`,
          backgroundColor: priorityBorders[priority],
          color: COLORS.neutral[0],
          border: 'none',
          borderRadius: BORDER_RADIUS.md,
          fontWeight: '600',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Agir Agora
      </button>
    </div>
  );
};
