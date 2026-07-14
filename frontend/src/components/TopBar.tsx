import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Download, Bell, Calendar } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useTheme } from '../contexts/ThemeContext';
import { useFilters } from '../contexts/FilterContext';
import { routes } from '../router/routes';

interface TopBarProps {
  title?: string;
  breadcrumb?: string[];
}

const filterOptions = ['Procedimento', 'Profissional', 'SDR', 'Campanha', 'Ad Set', 'Pipeline', 'Status'];

const TopBar: React.FC<TopBarProps> = ({ title: customTitle, breadcrumb: customBreadcrumb }) => {
  const location = useLocation();
  const { notifications } = useAppStore();
  const { mode } = useTheme();
  const { filters, getPeriodLabel } = useFilters();
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Determine current page info from routes
  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = customTitle || currentRoute?.label || 'Dashboard';
  const pageBreadcrumb = customBreadcrumb || [currentRoute?.label || 'Dashboard'];

  const bgColor = mode === 'dark' ? '#0f172a' : '#ffffff';
  const borderColor = mode === 'dark' ? '#1e293b' : '#e2e8f0';
  const textColor = mode === 'dark' ? '#f8fafc' : '#0f172a';
  const secondaryText = mode === 'dark' ? '#94a3b8' : '#94a3b8';
  const hoverBg = mode === 'dark' ? '#1e293b' : '#f8fafc';

  const unreadNotifications = notifications.filter((n) => !n.read).length;

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
        {/* Export Button */}
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
