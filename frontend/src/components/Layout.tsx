import React, { ReactNode, useState } from 'react';
import { Menu, X, Search, Settings } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS } from '../styles/tokens';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const menuItems = [
    { id: 'executive', label: 'Executive', icon: '📊' },
    { id: 'marketing', label: 'Marketing', icon: '📈' },
    { id: 'comercial', label: 'Comercial', icon: '🤝' },
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'agenda', label: 'Agenda', icon: '📅' },
    { id: 'campanhas', label: 'Campanhas', icon: '📢' },
    { id: 'conjuntos', label: 'Conjuntos', icon: '🎯' },
    { id: 'criativos', label: 'Criativos', icon: '🎨' },
    { id: 'pacientes', label: 'Pacientes', icon: '👤' },
    { id: 'profissionais', label: 'Profissionais', icon: '👨‍⚕️' },
    { id: 'sdrs', label: 'SDRs', icon: '📞' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { id: 'financeiro', label: 'Financeiro', icon: '💰' },
    { id: 'ia', label: 'IA', icon: '🤖' },
    { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: COLORS.neutral[50] }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? '280px' : '0',
          backgroundColor: COLORS.neutral[900],
          color: COLORS.neutral[0],
          overflow: 'hidden',
          transition: 'width 200ms ease-in-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{ padding: SPACING.lg, borderBottom: `1px solid ${COLORS.neutral[800]}` }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700' }}>Vivera</h1>
          <p style={{ fontSize: '12px', color: COLORS.neutral[400], marginTop: '4px' }}>
            Command Center
          </p>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: SPACING.md }}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                padding: `${SPACING.md} ${SPACING.lg}`,
                marginBottom: SPACING.sm,
                backgroundColor: currentPage === item.id ? COLORS.primary[600] : 'transparent',
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
                if (currentPage !== item.id) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLORS.neutral[700];
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
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
            borderTop: `1px solid ${COLORS.neutral[800]}`,
            fontSize: '12px',
            color: COLORS.neutral[400],
          }}
        >
          <p>© 2024 Vivera</p>
          <p>v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header
          style={{
            backgroundColor: COLORS.neutral[0],
            borderBottom: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.lg,
          }}
        >
          {/* Menu Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: COLORS.neutral[700],
            }}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Search */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              maxWidth: '400px',
            }}
          >
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: SPACING.md,
                top: '50%',
                transform: 'translateY(-50%)',
                color: COLORS.neutral[400],
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
                border: `1px solid ${COLORS.neutral[200]}`,
                backgroundColor: COLORS.neutral[50],
                fontSize: '14px',
              }}
            />
          </div>

          {/* Global Filters */}
          <div style={{ display: 'flex', gap: SPACING.md }}>
            <select
              defaultValue="month"
              style={{
                padding: `${SPACING.md} ${SPACING.lg}`,
                borderRadius: BORDER_RADIUS.md,
                border: `1px solid ${COLORS.neutral[200]}`,
                backgroundColor: COLORS.neutral[0],
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="today">Hoje</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="year">Ano</option>
            </select>

            <button
              style={{
                padding: `${SPACING.md} ${SPACING.lg}`,
                borderRadius: BORDER_RADIUS.md,
                border: `1px solid ${COLORS.neutral[200]}`,
                backgroundColor: COLORS.neutral[0],
                cursor: 'pointer',
                color: COLORS.neutral[700],
              }}
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
          }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          style={{
            backgroundColor: COLORS.neutral[100],
            borderTop: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.md,
            fontSize: '12px',
            color: COLORS.neutral[500],
            textAlign: 'center',
          }}
        >
          Vivera Command Center | Dados atualizados em tempo real
        </footer>
      </div>
    </div>
  );
};

export default Layout;
