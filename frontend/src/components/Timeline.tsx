import React from 'react';
import { Circle, ChevronRight } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';

interface TimelineEvent {
  id: string;
  stage: string;
  date: string;
  time: string;
  responsible: string;
  durationFromPrevious?: number;
  notes?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  title?: string;
}

const Timeline: React.FC<TimelineProps> = ({ events, title = 'Jornada do Paciente' }) => {
  const stageColors: Record<string, string> = {
    lead: COLORS.info[500],
    qualified: COLORS.primary[500],
    scheduled: COLORS.alert[500],
    attended: COLORS.success[500],
    purchased: COLORS.success[700],
    follow_up: COLORS.neutral[500],
  };

  const stageLabels: Record<string, string> = {
    lead: 'Lead',
    qualified: 'Qualificado',
    scheduled: 'Agendado',
    attended: 'Compareceu',
    purchased: 'Comprou',
    follow_up: 'Follow-up',
  };

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

      <div style={{ position: 'relative', paddingLeft: SPACING.xl }}>
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: '16px',
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: COLORS.neutral[200],
          }}
        />

        {/* Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
          {events.map((event, idx) => (
            <div key={event.id} style={{ position: 'relative' }}>
              {/* Circle indicator */}
              <div
                style={{
                  position: 'absolute',
                  left: '-30px',
                  top: '4px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: stageColors[event.stage] || COLORS.neutral[400],
                  border: `3px solid ${COLORS.neutral[0]}`,
                  boxSizing: 'border-box',
                }}
              />

              {/* Content */}
              <div
                style={{
                  backgroundColor: COLORS.neutral[50],
                  borderRadius: BORDER_RADIUS.md,
                  padding: SPACING.md,
                  borderLeft: `3px solid ${stageColors[event.stage] || COLORS.neutral[400]}`,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: SPACING.sm,
                  }}
                >
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: COLORS.neutral[900],
                    }}
                  >
                    {stageLabels[event.stage] || event.stage}
                  </h4>
                  <span
                    style={{
                      fontSize: '12px',
                      color: COLORS.neutral[500],
                    }}
                  >
                    {event.date} • {event.time}
                  </span>
                </div>

                {/* Details */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: SPACING.md,
                    fontSize: '12px',
                    marginBottom: SPACING.sm,
                  }}
                >
                  <div>
                    <p style={{ color: COLORS.neutral[500] }}>Responsável</p>
                    <p style={{ color: COLORS.neutral[900], fontWeight: '600' }}>
                      {event.responsible}
                    </p>
                  </div>

                  {event.durationFromPrevious !== undefined && (
                    <div>
                      <p style={{ color: COLORS.neutral[500] }}>Tempo desde etapa anterior</p>
                      <p style={{ color: COLORS.neutral[900], fontWeight: '600' }}>
                        {event.durationFromPrevious} dias
                      </p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {event.notes && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: COLORS.neutral[600],
                      fontStyle: 'italic',
                      marginTop: SPACING.sm,
                    }}
                  >
                    "{event.notes}"
                  </p>
                )}

                {/* Next step indicator */}
                {idx < events.length - 1 && (
                  <div
                    style={{
                      marginTop: SPACING.md,
                      paddingTop: SPACING.md,
                      borderTop: `1px solid ${COLORS.neutral[200]}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACING.sm,
                      fontSize: '12px',
                      color: COLORS.primary[600],
                    }}
                  >
                    Próximo passo <ChevronRight size={14} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
