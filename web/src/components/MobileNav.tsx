import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilters } from '@/lib/FilterContext'
import { NAV_ITEMS } from '@/lib/nav'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const { data } = useFilters()
  const semOrigemCount = data?.leadsSemOrigem.length ?? 0
  const outrasFromCount = data?.leadsOutrasFontes.length ?? 0

  return (
    <div className="flex items-center border-b border-border px-3 py-2 md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="ml-2 text-sm font-bold tracking-tight">Vivera <span className="text-accent">Insights</span></span>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="relative flex h-full w-64 flex-col gap-0.5 bg-background p-2 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-2 py-2">
              <span className="text-sm font-bold tracking-tight">Vivera <span className="text-accent">Insights</span></span>
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                    isActive && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/sem-origem' && semOrigemCount > 0 && (
                  <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">{semOrigemCount}</span>
                )}
                {item.to === '/outras-fontes' && outrasFromCount > 0 && (
                  <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">{outrasFromCount}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
