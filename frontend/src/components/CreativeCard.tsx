import React from 'react';
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../styles/tokens';

interface CreativeCardProps {
  thumbnail?: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  revenue: number;
  investment: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  ticket: number;
  revenuePerLead: number;
  revenuePerAppointment: number;
  trend: number;
  saturation: number; // 0-100
  aiInsight?: string;
  metaLink?: string;
  onClick?: () => void;
}

const CreativeCard: React.FC<CreativeCardProps> = ({
  thumbnail,
  name,
  status,
  revenue,
  investment,
  roas,
  ctr,
  cpc,
  cpm,
  impressions,
  clicks,
  leads,
  purchases,
  ticket,
  revenuePerLead,
  revenuePerAppointment,
  trend,
  saturation,
  aiInsight,
  metaLink,
  onClick,
}) => {
  const statusColors = {
    active: COLORS.success[500],
    paused: COLORS.alert[500],
    archived: COLORS.neutral[400],
  };

  const statusLabels = {
    active: 'Ativo',
    paused: 'Pausado',
    archived: 'Arquivado',
  };

  const trendIcon = trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  const trendColor = trend > 0 ? COLORS.success[500] : COLORS.critical[500];

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: COLORS.neutral[0],
        borderRadius: BORDER_RADIUS.lg,
        border: `1px solid ${COLORS.neutral[200]}`,
        overflow: 'hidden',
        transition: 'all 200ms ease-in-out',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: SHADOWS.sm,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = SHADOWS.lg;
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = SHADOWS.sm;
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Thumbnail */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={name}
          style={{
            width: '100%',
            height: '160px',
            objectFit: 'cover',
            backgroundColor: COLORS.neutral[200],
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '160px',
            backgroundColor: COLORS.neutral[200],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.neutral[400],
            fontSize: '12px',
          }}
        >
          Sem imagem
        </div>
      )}

      {/* Content */}
      <div
        style={{
          padding: SPACING.lg,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        {/* Header */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              marginBottom: SPACING.sm,
              gap: SPACING.md,
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: COLORS.neutral[900],
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </h3>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: `2px ${SPACING.sm}`,
                borderRadius: BORDER_RADIUS.sm,
                backgroundColor: statusColors[status],
                color: COLORS.neutral[0],
                whiteSpace: 'nowrap',
              }}
            >
              {statusLabels[status]}
            </span>
          </div>

          {metaLink && (
            <a
              href={metaLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: '11px',
                color: COLORS.primary[600],
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Ver no Meta <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: SPACING.md,
            fontSize: '11px',
          }}
        >
          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>Receita</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>
              R$ {revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>Investimento</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>
              R$ {investment.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>ROAS</p>
            <p
              style={{
                fontWeight: '600',
                color: roas > 3 ? COLORS.success[500] : roas > 1 ? COLORS.alert[500] : COLORS.critical[500],
              }}
            >
              {roas.toFixed(2)}x
            </p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>CTR</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>{ctr.toFixed(2)}%</p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>Impressões</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>
              {impressions.toLocaleString('pt-BR')}
            </p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>Cliques</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>
              {clicks.toLocaleString('pt-BR')}
            </p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>Leads</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>
              {leads.toLocaleString('pt-BR')}
            </p>
          </div>

          <div>
            <p style={{ color: COLORS.neutral[500], marginBottom: '2px' }}>Compras</p>
            <p style={{ fontWeight: '600', color: COLORS.neutral[900] }}>
              {purchases.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Saturation */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
              fontSize: '11px',
            }}
          >
            <span style={{ color: COLORS.neutral[500] }}>Saturação</span>
            <span
              style={{
                color: saturation > 80 ? COLORS.critical[500] : saturation > 50 ? COLORS.alert[500] : COLORS.success[500],
                fontWeight: '600',
              }}
            >
              {saturation.toFixed(0)}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: COLORS.neutral[200],
              borderRadius: BORDER_RADIUS.sm,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${saturation}%`,
                backgroundColor:
                  saturation > 80 ? COLORS.critical[500] : saturation > 50 ? COLORS.alert[500] : COLORS.success[500],
                transition: 'width 300ms ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Trend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            color: trendColor,
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          {trendIcon}
          {trend > 0 ? '+' : ''}{trend.toFixed(1)}% {trend > 0 ? 'crescimento' : 'queda'}
        </div>

        {/* AI Insight */}
        {aiInsight && (
          <div
            style={{
              backgroundColor: COLORS.info[50],
              border: `1px solid ${COLORS.info[200]}`,
              borderRadius: BORDER_RADIUS.md,
              padding: SPACING.sm,
              fontSize: '11px',
              color: COLORS.info[700],
            }}
          >
            💡 {aiInsight}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreativeCard;
