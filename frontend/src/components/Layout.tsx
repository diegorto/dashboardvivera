import React, { ReactNode } from 'react';
import { Menu, X, Search, Settings, Sun, Moon, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';
import { useAppStore } from '../stores/appStore';
import { useTheme } from '../contexts/ThemeContext';
import { useFilters } from '../contexts/FilterContext';
import { routes } from '../router/routes';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, setCurrentPage, searchQuery, setSearchQuery, notifications } =
    useAppStore();
  const { mode, toggleTheme } = useTheme();
  const { filters, setFilter, getPeriodLabel } = useFilters();
  const themeColors = useTheme();

  const mainRoutes = routes.filter((r) => r.category !== 'detail');
  const currentRoute = routes.find((r) => r.path === location.pathname);

  const bgColor = mode === 'dark' ? COLORS.neutral[900] : COLORS.neutral[0];
  const sidebarBgColor = mode === 'dark' ? COLORS.neutral[800] : COLORS.neutral[50];
  const textColor = mode === 'dark' ? COLORS.neutral[0] : COLORS.neutral[900];
  const borderColor = mode === 'dark' ? COLORS.neutral[700] : COLORS.neutral[200];

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: bgColor,
        color: textColor,
        transition: 'background-color 200ms',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? '280px' : '0',
          backgroundColor: mode === 'dark' ? COLORS.neutral[900] : COLORS.neutral[0],
          borderRight: `1px solid ${borderColor}`,
          overflow: 'hidden',
          transition: 'width 200ms ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: mode === 'dark' ? '0 0 20px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: SPACING.lg,
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: COLORS.primary[600] }}>
            Vivera
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: mode === 'dark' ? COLORS.neutral[400] : COLORS.neutral[500],
              marginTop: '4px',
            }}
          >
            Command Center
          </p>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: SPACING.md }}>
          {mainRoutes.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id);
                navigate(item.path);
              }}
              style={{
                width: '100%',
                padding: `${SPACING.md} ${SPACING.lg}`,
                marginBottom: SPACING.sm,
                backgroundColor:
                  location.pathname === item.path ? COLORS.primary[600] : 'transparent',
                color: COLORS.neutral[0],
                border: 'none',
                borderRadius: BORDER_RADIUS.md,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 200ms ease-in-out',
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== item.path) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    mode === 'dark' ? COLORS.neutral[700] : COLORS.neutral[100];
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.path) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ marginRight: SPACING.sm }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: SPACING.lg,
            borderTop: `1px solid ${borderColor}`,
            fontSize: '12px',
            color: mode === 'dark' ? COLORS.neutral[400] : COLORS.neutral[500],
          }}
        >
          <p>© 2024 Vivera</p>
          <p style={{ marginTop: '4px' }}>v1.0.0-beta</p>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header
          style={{
            backgroundColor: bgColor,
            borderBottom: `1px solid ${borderColor}`,
            padding: SPACING.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.lg,
            boxShadow: mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            zIndex: 10,
          }}
        >
          {/* Left: Menu Toggle + Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg, flex: 1 }}>
            {/* Menu Toggle */}
            <button
              onClick={toggleSidebar}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: textColor,
                padding: '4px',
              }}
              title={sidebarOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Search */}
            <div
              style={{
                position: 'relative',
                maxWidth: '400px',
                flex: 1,
              }}
            >
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: SPACING.md,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: mode === 'dark' ? COLORS.neutral[400] : COLORS.neutral[400],
                }}
              />
              <input
                type="text"
                placeholder="Pesquisa global..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.xl}`,
                  borderRadius: BORDER_RADIUS.md,
                  border: `1px solid ${borderColor}`,
                  backgroundColor: mode === 'dark' ? COLORS.neutral[800] : COLORS.neutral[50],
                  fontSize: '14px',
                  color: textColor,
                }}
              />
            </div>
          </div>

          {/* Right: Filters + Theme + Notifications + Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
            {/* Period Filter */}
            <select
              value={filters.period}
              onChange={(e) => setFilter('period', e.target.value as any)}
              style={{
                padding: `${SPACING.md} ${SPACING.lg}`,
                borderRadius: BORDER_RADIUS.md,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                color: textColor,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="today">Hoje</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="year">Ano</option>
            </select>

            {/* Notifications */}
            <button
              style={{
                padding: `${SPACING.md} ${SPACING.md}`,
                borderRadius: BORDER_RADIUS.md,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                cursor: 'pointer',
                color: textColor,
                position: 'relative',
              }}
              title={`${notifications.length} notificações`}
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: COLORS.critical[500],
                    color: COLORS.neutral[0],
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {Math.min(notifications.length, 9)}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                padding: `${SPACING.md} ${SPACING.md}`,
                borderRadius: BORDER_RADIUS.md,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                cursor: 'pointer',
                color: textColor,
              }}
              title={`Mudar para ${mode === 'light' ? 'dark' : 'light'} mode`}
            >
              {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Settings */}
            <button
              style={{
                padding: `${SPACING.md} ${SPACING.md}`,
                borderRadius: BORDER_RADIUS.md,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                cursor: 'pointer',
                color: textColor,
              }}
              onClick={() => navigate('/configuracoes')}
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: SPACING.xl,
            backgroundColor: sidebarBgColor,
          }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          style={{
            backgroundColor: bgColor,
            borderTop: `1px solid ${borderColor}`,
            padding: SPACING.md,
            fontSize: '12px',
            color: mode === 'dark' ? COLORS.neutral[400] : COLORS.neutral[500],
            textAlign: 'center',
          }}
        >
          Vivera Command Center | {getPeriodLabel()} | Dados atualizados em tempo real
        </footer>
      </div>
    </div>
  );
};

export default Layout;
