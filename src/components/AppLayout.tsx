import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Sparkles,
  FolderLock,
  ClipboardList,
  Bell,
  Bot,
  Settings,
  Menu,
  X,
  Search,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Book,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { Logo } from './Logo'
import { Avatar } from './ui'
import { cn } from '../lib/cn'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/scholarships', label: 'Scholarships', icon: Book },
  { to: '/app/matches', label: 'Scholarship Matches', icon: Sparkles },
  { to: '/app/applications', label: 'My Applications', icon: ClipboardList },
  { to: '/app/vault', label: 'Document Vault', icon: FolderLock },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/assistant', label: 'Decision Bot', icon: Bot },
]

const secondary = [
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Admin Console', icon: ShieldCheck },
]

function SidebarContent({
  onNavigate,
  badges = {},
  isStaff = false,
}: {
  onNavigate?: () => void
  badges?: Record<string, number>
  isStaff?: boolean
}) {
  const secondaryNav = secondary.filter((item) => item.to !== '/admin' || isStaff)
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Student
        </p>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-900 dark:hover:text-ink-100',
              )
            }
          >
            {({ isActive }) => {
              const badge = badges[item.to]
              return (
                <>
                  <item.icon
                    className={cn('h-[18px] w-[18px]', isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600')}
                  />
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        isActive ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </>
              )
            }}
          </NavLink>
        ))}

        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          More
        </p>
        {secondaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] text-ink-400 group-hover:text-ink-600" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-100">
          <ShieldCheck className="h-4 w-4" /> Secure Vault
        </div>
        <p className="mt-2 text-sm font-medium leading-snug">
          Your documents are AES-256 encrypted at rest.
        </p>
        <NavLink
          to="/app/vault"
          onClick={onNavigate}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-300 hover:text-gold-400"
        >
          Manage documents →
        </NavLink>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [counts, setCounts] = useState({ matches: 0, applications: 0, unread: 0 })

  // Sidebar/topbar counts reflect the logged-in user's real data, refreshed on
  // navigation so applying or reading notifications updates them.
  useEffect(() => {
    let active = true
    Promise.all([
      api.matches.list().catch(() => []),
      api.applications.list().catch(() => []),
      api.notifications.list().catch(() => []),
    ]).then(([m, a, n]) => {
      if (!active) return
      setCounts({
        matches: (m as any[]).filter((x) => x.status !== 'Not eligible').length,
        applications: (a as any[]).length,
        unread: (n as any[]).filter((x) => !x.read).length,
      })
    })
    return () => {
      active = false
    }
  }, [location.pathname])

  const badges: Record<string, number> = {
    '/app/matches': counts.matches,
    '/app/applications': counts.applications,
  }
  const unread = counts.unread

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Your account'
  const initials =
    ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase() ||
    (user?.email?.[0] || 'U').toUpperCase()
  const subLabel = user?.profile?.student_id || user?.email || ''

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-950 lg:block">
        <SidebarContent badges={badges} isStaff={!!user?.is_staff} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent badges={badges} isStaff={!!user?.is_staff} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/80 dark:border-ink-800 dark:bg-ink-950/80 px-4 backdrop-blur-md sm:px-6">
          <button
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              placeholder="Search scholarships, applications, documents…"
              className="h-10 w-full max-w-md rounded-xl border border-ink-200 bg-ink-50 pl-9 pr-4 text-sm text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:focus:border-brand-500"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <NavLink
              to="/app/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </NavLink>

            <div className="mx-1 hidden h-6 w-px bg-ink-200 sm:block" />

            <NavLink
              to="/app/settings"
              className="flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2 hover:bg-ink-50"
            >
              <Avatar initials={initials} className="h-8 w-8 text-xs" />
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold text-ink-800">{fullName}</p>
                {subLabel && <p className="text-[11px] text-ink-400">{subLabel}</p>}
              </div>
              <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
            </NavLink>

            <NavLink
              to="/login"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600"
              title="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </NavLink>
          </div>
        </header>

        <main key={location.pathname} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
