import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Download, Bell, Calendar, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useTheme } from '../contexts/ThemeContext';
import { useFilters } from '../contexts/FilterContext';
import { routes } from '../router/routes';

interface TopBarProps {
  title?: string;
  breadcrumb?: string[];
  right?: React.ReactNode;
}

const filterOptions = ['Procedimento', 'Profissional', 'SDR', 'Campanha', 'Ad Set', 'Pipeline', 'Status'];

const TopBar: React.FC<TopBarProps> = ({ title: customTitle, breadcrumb: customBreadcrumb, right }) => {
  const location = useLocation();
  const { notifications } = useAppStore();
  const { mode, toggleTheme } = useTheme();
  const { filters, setFilter, setFilters, getPeriodLabel } = useFilters();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const periodOptions = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Esta semana' },
    { value: 'lastWeek', label: 'Semana passada' },
    { value: 'month', label: 'Este mês' },
    { value: 'lastMonth', label: 'Mês passado' },
    { value: 'last30', label: 'Últimos 30 dias' },
    { value: 'year', label: 'Este ano' },
  ];

  const handlePeriodChange = (periodValue: string) => {
    setFilter('period', periodValue);
    setShowDatePicker(false);
  };

  // Datas do input (YYYY-MM-DD) viram Date no fuso LOCAL (não UTC)
  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    const startDate = parseLocalDate(customStart);
    const endDate = parseLocalDate(customEnd);
    if (startDate > endDate) return;
    setFilters({ period: 'custom', dateRange: { startDate, endDate } });
    setShowDatePicker(false);
  };

  // Determine current page info from routes
  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = customTitle || currentRoute?.label || 'Dashboard';
  const pageBreadcrumb = customBreadcrumb || [currentRoute?.label || 'Dashboard'];

  const bgColor = mode === 'dark' ? '#0f172a' : '#ffffff';
  const borderColor = mode === 'dark' ? '#1e293b' : '#e2e8f0';
  const textColor = mode === 'dark' ? '#f8fafc' : '#0f172a';
  const secondaryText = mode === 'dark' ? '#94a3b8' : '#94a3b8';
  const hoverBg = mode === 'dark' ? '#1e293b' : '#f8fafc';

  const unreadNotifications = notifications.length;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: bgColor,
        borderBottom: `1px solid ${borderColor}`,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        transition: 'background-color 200ms',
      }}
    >
      {/* Breadcrumb + Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            color: secondaryText,
            fontWeight: 500,
            marginBottom: '4px',
          }}
        >
          {pageBreadcrumb.join(' / ')}
        </div>
        <h1
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: textColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pageTitle}
        </h1>
      </div>

      {/* Date Range */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            fontSize: '12px',
            color: '#475569',
            backgroundColor: bgColor,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background-color 200ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgColor)}
        >
          <Calendar size={14} color={secondaryText} />
          {getPeriodLabel()}
          <ChevronDown size={14} color={secondaryText} />
        </button>

        {/* Date Picker Dropdown */}
        {showDatePicker && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              boxShadow: mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              minWidth: '180px',
            }}
          >
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePeriodChange(option.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  backgroundColor: filters.period === option.value ? '#f0f4ff' : 'transparent',
                  color: filters.period === option.value ? '#6366f1' : textColor,
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 200ms',
                }}
                onMouseEnter={(e) => {
                  if (filters.period !== option.value) {
                    e.currentTarget.style.backgroundColor = hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = filters.period === option.value ? '#f0f4ff' : 'transparent';
                }}
              >
                {option.label}
              </button>
            ))}

            {/* Range personalizado */}
            <div style={{ borderTop: `1px solid ${borderColor}`, padding: '10px 12px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: filters.period === 'custom' ? '#6366f1' : secondaryText,
                  marginBottom: '6px',
                }}
              >
                Personalizado
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{
                    fontSize: '12px',
                    padding: '5px 8px',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                    color: textColor,
                    backgroundColor: bgColor,
                  }}
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    fontSize: '12px',
                    padding: '5px 8px',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                    color: textColor,
                    backgroundColor: bgColor,
                  }}
                />
                <button
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd}
                  style={{
                    padding: '6px 8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'white',
                    backgroundColor: customStart && customEnd ? '#6366f1' : '#c7d2fe',
                    cursor: customStart && customEnd ? 'pointer' : 'not-allowed',
                  }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {filterOptions.map((f) => (
          <button
            key={f}
            style={{
              padding: '6px 10px',
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              fontSize: '11px',
              color: '#64748b',
              backgroundColor: bgColor,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgColor)}
          >
            {f} <ChevronDown size={12} style={{ display: 'inline-block', marginLeft: '4px' }} />
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
        {/* Custom right content or default Export Button */}
        {right || (
          <button
            style={{
              padding: '6px 12px',
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              fontSize: '12px',
              color: '#475569',
              backgroundColor: bgColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgColor)}
          >
            <Download size={14} />
            Export
          </button>
        )}

        {/* Aparência clara/escura */}
        <button
          onClick={toggleTheme}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 200ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title={mode === 'light' ? 'Mudar para aparência escura' : 'Mudar para aparência clara'}
        >
          {mode === 'light' ? <Sun size={18} color={secondaryText} /> : <Moon size={18} color={secondaryText} />}
        </button>

        {/* Notifications */}
        <button
          style={{
            position: 'relative',
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 200ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title={`${unreadNotifications} notificações não lidas`}
        >
          <Bell size={18} color={secondaryText} />
          {unreadNotifications > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '6px',
                height: '6px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
              }}
            />
          )}
        </button>

        {/* User Avatar */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          DR
        </div>
      </div>
    </div>
  );
};

export default TopBar;
