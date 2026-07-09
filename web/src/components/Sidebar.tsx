import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Megaphone, Filter as FunnelIcon, GitBranch, Users, Lightbulb, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilters } from '@/lib/FilterContext'

const NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/funil', label: 'Funil', icon: FunnelIcon },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/sem-origem', label: 'Sem Origem', icon: SearchX },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
]

export function Sidebar() {
  const { data } = useFilters()
  const semOrigemCount = data?.leadsSemOrigem.length ?? 0

  return (
    <aside className="hidden w-52 shrink-0 border-r border-border md:block">
      <div className="flex h-14 items-center px-4">
        <span className="text-sm font-bold tracking-tight">Vivera <span className="text-accent">Insights</span></span>
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/sem-origem' && semOrigemCount > 0 && (
              <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">{semOrigemCount}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
