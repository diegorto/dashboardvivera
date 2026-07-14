import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  group?: string;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'executive', label: 'Executive', icon: '◆', group: 'Intelligence', path: '/' },
  { id: 'marketing', label: 'Marketing Intelligence', icon: '◈', group: 'Intelligence', path: '/marketing' },
  { id: 'commercial', label: 'Commercial Intelligence', icon: '◉', group: 'Intelligence', path: '/comercial' },
  { id: 'crm', label: 'CRM Intelligence', icon: '⬡', group: 'Intelligence', path: '/crm' },
  { id: 'financial', label: 'Finance', icon: '◑', group: 'Intelligence', path: '/financeiro' },
  { id: 'campaigns', label: 'Campaigns', icon: '▣', group: 'Media', path: '/campanhas' },
  { id: 'creatives', label: 'Creatives', icon: '▤', group: 'Media', path: '/criativos' },
  { id: 'agenda', label: 'Agenda', icon: '▦', group: 'Operations', path: '/agenda' },
  { id: 'patients', label: 'Patients', icon: '▧', group: 'Operations', path: '/pacientes' },
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
  const groups = ['Intelligence', 'Media', 'Operations', 'AI', 'System'];

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
        className={`fixed lg:static left-0 top-0 h-screen w-56 bg-[#0f172a] border-r border-[#1e293b] shrink-0 flex flex-col z-40 transition-transform lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#1e293b]">
          <div className="w-7 h-7 rounded-md bg-[#6366f1] flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <div>
            <div className="text-white text-sm font-semibold tracking-tight">Vivera</div>
            <div className="text-[#475569] text-[10px] font-medium tracking-widest uppercase">
              Command Center
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {groups.map((group) => {
            const items = navItems.filter((i) => i.group === group);
            return (
              <div key={group} className="mb-1">
                <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#334155]">
                  {group}
                </div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleNavigate(item);
                      if (window.innerWidth < 1024) {
                        toggleSidebar();
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-5 py-2 text-sm transition-all ${
                      currentActive === item.id
                        ? 'bg-[#1e293b] text-white border-r-2 border-[#6366f1]'
                        : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b]/50'
                    }`}
                  >
                    <span className="text-xs opacity-60">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-5 py-4 border-t border-[#1e293b] flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] text-xs font-bold">
            DR
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">Dr. Ramos</div>
            <div className="text-[#475569] text-[10px]">Diretor Geral</div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
