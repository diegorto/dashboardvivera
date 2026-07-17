import React from 'react';

interface TimeRangeData {
  range: string;
  leads: number;
  qualified: number;
  scheduled: number;
  attended: number;
  qualificationRate: number;
  schedulingRate: number;
  attendanceRate: number;
}

interface SDRData {
  name: string;
  avgResponseTime: number; // em minutos
  qualificationRate: number;
  schedulingRate: number;
  attendanceRate: number;
}

interface ResponseSpeedCardProps {
  title: string;
  subtitle: string;
  avgResponseTime: number; // em minutos
  fastResponsePercentage: number; // % respondidos em menos de 5 min
  extraRevenue: number;
  timeRangeData: TimeRangeData[];
  sdrData: SDRData[];
  speedGoal?: string;
  speedGoalPercentage?: number;
  impactInsight?: string;
  aiInsight?: string;
}

const ResponseSpeedCard: React.FC<ResponseSpeedCardProps> = ({
  title,
  subtitle,
  avgResponseTime,
  fastResponsePercentage,
  extraRevenue,
  timeRangeData,
  sdrData,
  speedGoal,
  speedGoalPercentage,
  impactInsight,
  aiInsight,
}) => {
  const getColor = (rate: number) => {
    if (rate >= 70) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  };

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
          gap: '24px',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #f0f4f8',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Tempo médio de resposta
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#6366f1', lineHeight: '1' }}>
            {avgResponseTime.toFixed(1)} min
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Respondidos em menos de 5 min
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#6366f1', lineHeight: '1' }}>
            {fastResponsePercentage.toFixed(1)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Receita extra (rápido vs. lento)
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', lineHeight: '1' }}>
            +R$ {(extraRevenue / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      {/* Time Range Table */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
          Conversão por faixa de tempo de resposta
        </h3>
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
                  TEMPO 1A RESPOSTA
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  LEADS
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  QUALIFICADOS
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  AGENDADOS
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  COMPARECERAM
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  % QUALIF.
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  % AGEND.
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>
                  % COMPAR.
                </th>
              </tr>
            </thead>
            <tbody>
              {timeRangeData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 0', color: '#0f172a', fontWeight: '500' }}>
                    {row.range}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                    {row.leads}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                    {row.qualified}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                    {row.scheduled}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                    {row.attended}
                  </td>
                  <td
                    style={{
                      padding: '12px 0',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: getColor(row.qualificationRate),
                    }}
                  >
                    {row.qualificationRate}%
                  </td>
                  <td
                    style={{
                      padding: '12px 0',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: getColor(row.schedulingRate),
                    }}
                  >
                    {row.schedulingRate}%
                  </td>
                  <td
                    style={{
                      padding: '12px 0',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: getColor(row.attendanceRate),
                    }}
                  >
                    {row.attendanceRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impact Insight */}
      {impactInsight && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '24px',
            fontSize: '11px',
            color: '#92400e',
          }}
        >
          <strong>⚡ Impacto de velocidade:</strong> {impactInsight}
        </div>
      )}

      {/* SDR Response Times */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>
          Tempo médio de resposta por SDR
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
          }}
        >
          {sdrData.map((sdr, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #f0f4f8',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                {sdr.name}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#6366f1',
                  marginBottom: '12px',
                  lineHeight: '1',
                }}
              >
                {sdr.avgResponseTime.toFixed(1)} min
              </div>
              <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Qualif.</span>
                  <span style={{ fontWeight: '600', color: getColor(sdr.qualificationRate) }}>
                    {sdr.qualificationRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Agend.</span>
                  <span style={{ fontWeight: '600', color: getColor(sdr.schedulingRate) }}>
                    {sdr.schedulingRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Compar.</span>
                  <span style={{ fontWeight: '600', color: getColor(sdr.attendanceRate) }}>
                    {sdr.attendanceRate}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Speed Goal */}
      {speedGoal && speedGoalPercentage !== undefined && (
        <div
          style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>
            Meta de velocidade
          </div>
          <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '8px' }}>
            {speedGoal}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                flex: 1,
                height: '8px',
                backgroundColor: '#e0f2fe',
                borderRadius: '4px',
                overflow: 'hidden',
                marginRight: '12px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(speedGoalPercentage, 100)}%`,
                  backgroundColor: '#0ea5e9',
                  transition: 'width 300ms ease-in-out',
                }}
              />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0369a1', minWidth: '40px' }}>
              {speedGoalPercentage.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* AI Insight Full */}
      {aiInsight && (
        <div
          style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '12px',
            marginTop: '16px',
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

export default ResponseSpeedCard;
