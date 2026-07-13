import { LayoutDashboard, Megaphone, Filter as FunnelIcon, GitBranch, Users, Lightbulb, SearchX, ShieldCheck, Building2, Layers, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/funil', label: 'Funil', icon: FunnelIcon },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/recepcao', label: 'Recepção', icon: Building2 },
  { to: '/sem-origem', label: 'Sem Origem', icon: SearchX },
  { to: '/outras-fontes', label: 'Outras Fontes', icon: Layers },
  { to: '/auditoria-tintim', label: 'Auditoria Tintim', icon: ShieldCheck },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
]
