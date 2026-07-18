import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useTheme } from '../contexts/ThemeContext';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  group?: string;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'executive', label: 'Executive Dashboard', icon: '◆', group: 'Intelligence', path: '/' },
  { id: 'crm', label: 'CRM Intelligence', icon: '⬡', group: 'Intelligence', path: '/crm' },
  { id: 'auditoria', label: 'Auditoria Tintim', icon: '◉', group: 'Intelligence', path: '/auditoria' },
  { id: 'google-ads', label: 'Google Ads', icon: '🔍', group: 'Media', path: '/google-ads' },
  { id: 'meta-ads', label: 'Meta Ads', icon: '📱', group: 'Media', path: '/meta-ads' },
  { id: 'campaigns', label: 'Campaigns', icon: '▣', group: 'Media', path: '/campanhas' },
  { id: 'creatives', label: 'Creatives', icon: '▤', group: 'Media', path: '/criativos' },
  { id: 'agenda', label: 'Agenda', icon: '▦', group: 'Operations', path: '/agenda' },
  { id: 'professionals', label: 'Professionals', icon: '▨', group: 'Operations', path: '/profissionais' },
  { id: 'sdrs', label: 'SDRs', icon: '▩', group: 'Operations', path: '/sdrs' },
  { id: 'whatsapp', label: 'WhatsApp Analytics', icon: '◫', group: 'Operations', path: '/whatsapp' },
  { id: 'ai', label: 'AI Executive', icon: '◬', group: 'AI', path: '/ia' },
  { id: 'reports', label: 'Reports', icon: '◭', group: 'AI', path: '/relatorios' },
  { id: 'settings', label: 'Settings', icon: '◮', group: 'System', path: '/configuracoes' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { mode } = useTheme();
  const groups = ['Intelligence', 'Media', 'Operations', 'AI', 'System'];

  // Cores baseadas no tema
  const colors = {
    bg: mode === 'dark' ? '#0f172a' : '#ffffff',
    border: mode === 'dark' ? '#1e293b' : '#e2e8f0',
    textPrimary: mode === 'dark' ? '#ffffff' : '#0f172a',
    textSecondary: mode === 'dark' ? '#94a3b8' : '#64748b',
    textTertiary: mode === 'dark' ? '#475569' : '#94a3b8',
    groupText: mode === 'dark' ? '#334155' : '#64748b',
    activeBg: mode === 'dark' ? '#1e293b' : '#f0f4ff',
    hoverBg: mode === 'dark' ? '#1e293b' : '#f8fafc',
    accentBorder: '#6366f1',
    accentText: '#6366f1',
    avatarBg: mode === 'dark' ? '#6366f1' : '#e0e7ff',
  };

  const currentActive = navItems.find((item) => item.path === location.pathname)?.id || 'executive';

  const handleNavigate = (item: NavItem) => {
    navigate(item.path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static left-0 top-0 h-screen w-56 shrink-0 flex flex-col z-40 transition-all lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: colors.bg,
          borderRight: `1px solid ${colors.border}`,
        }}
      >
        {/* Logo Vivera - Orofacial Avançada */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div
            className="font-extrabold uppercase leading-none"
            style={{ fontSize: '22px', letterSpacing: '0.02em', fontStretch: 'condensed', color: colors.textPrimary }}
          >
            VIVERA
          </div>
          <div
            className="font-medium uppercase mt-1"
            style={{ fontSize: '8.5px', letterSpacing: '0.32em', color: colors.textSecondary }}
          >
            Orofacial Avançada
          </div>
          <div className="text-[9px] font-medium tracking-widest uppercase mt-1.5" style={{ color: colors.textTertiary }}>
            Command Center
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {groups.map((group) => {
            const items = navItems.filter((i) => i.group === group);
            return (
              <div key={group} className="mb-1">
                <div
                  className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: colors.groupText }}
                >
                  {group}
                </div>
                {items.map((item) => {
                  const isActive = currentActive === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleNavigate(item);
                        if (window.innerWidth < 1024) {
                          toggleSidebar();
                        }
                      }}
                      className="w-full flex items-center gap-3 px-5 py-2 text-sm transition-all"
                      style={{
                        backgroundColor: isActive ? colors.activeBg : 'transparent',
                        color: isActive ? colors.accentText : colors.textSecondary,
                        borderRight: isActive ? `2px solid ${colors.accentBorder}` : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = colors.hoverBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span className="text-xs opacity-60">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: colors.avatarBg, color: colors.accentText }}
          >
            DD
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: colors.textPrimary }}>
              Dr. Diego
            </div>
            <div className="text-[10px]" style={{ color: colors.textTertiary }}>
              Diretor Geral
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
