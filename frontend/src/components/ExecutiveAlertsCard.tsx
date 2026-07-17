import React from 'react';

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  title: string;
  timeAgo: string;
}

interface ExecutiveAlertsCardProps {
  title: string;
  alerts: AlertItem[];
}

const ExecutiveAlertsCard: React.FC<ExecutiveAlertsCardProps> = ({
  title,
  alerts,
}) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'success':
        return '#10b981';
      case 'info':
        return '#6366f1';
      default:
        return '#6366f1';
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
          {title}
        </h2>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#ef4444' }}>
          {alerts.length} alertas
        </span>
      </div>

      {/* Alerts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingBottom: '16px',
              borderBottom: '1px solid #f8fafc',
            }}
          >
            {/* Severity Dot */}
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getSeverityColor(alert.severity),
                flexShrink: 0,
              }}
            />

            {/* Alert Content */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>
                {alert.title}
              </div>
            </div>

            {/* Time Ago */}
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500', whiteSpace: 'nowrap' }}>
              {alert.timeAgo}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutiveAlertsCard;
