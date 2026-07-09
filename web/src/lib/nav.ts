import { LayoutDashboard, Megaphone, Filter as FunnelIcon, GitBranch, Users, Lightbulb, SearchX, type LucideIcon } from 'lucide-react'

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
  { to: '/sem-origem', label: 'Sem Origem', icon: SearchX },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
]
