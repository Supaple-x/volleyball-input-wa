import { Outlet, NavLink } from 'react-router'
import { Home, Users, Trophy, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Главная' },
  { to: '/matches', icon: Trophy, label: 'Матчи' },
  { to: '/teams', icon: Users, label: 'Команды' },
  { to: '/stats', icon: BarChart3, label: 'Статистика' },
] as const

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/90 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
