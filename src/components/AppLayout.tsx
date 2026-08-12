import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Compass,
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
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { motion } from 'framer-motion'
import { Logo } from './Logo'
import { Avatar } from './ui'
import { cn } from '../lib/cn'
import { pageEnter } from '../lib/motion'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/scholarships', label: 'Scholarships', icon: Compass },
  { to: '/app/applications', label: 'Applications', icon: ClipboardList },
  { to: '/app/vault', label: 'Document vault', icon: FolderLock },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/assistant', label: 'Decision bot', icon: Bot },
]

const secondary = [
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/admin', label: 'Admin console', icon: ShieldCheck },
]

function NavItem({
  item,
  badge,
  onNavigate,
}: {
  item: { to: string; label: string; icon: any; end?: boolean }
  badge?: number
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 py-2.5 pl-5 pr-4 text-sm font-medium transition-colors duration-[--dur]',
          isActive ? 'text-band-on' : 'text-band-muted hover:text-band-on',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Gold edge marks the active route */}
          <span
            className={cn(
              'absolute inset-y-1 left-0 w-[3px] rounded-r-full transition-colors duration-[--dur]',
              isActive ? 'bg-accent' : 'bg-transparent',
            )}
            aria-hidden
          />
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {badge ? (
            <span
              className={cn(
                'tabular shrink-0 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-bold',
                isActive ? 'bg-accent text-accent-on' : 'bg-band-rule text-band-muted',
              )}
            >
              {badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({
  onNavigate,
  badges = {},
  isStaff = false,
  completion,
}: {
  onNavigate?: () => void
  badges?: Record<string, number>
  isStaff?: boolean
  completion?: number
}) {
  const secondaryNav = secondary.filter((item) => item.to !== '/app/admin' || isStaff)

  return (
    <div className="flex h-full flex-col bg-band">
      <div className="flex h-16 shrink-0 items-center border-b border-band-rule px-5">
        <NavLink to="/app" onClick={onNavigate} aria-label="ScholarCircle dashboard">
          <Logo tone="band" size="sm" />
        </NavLink>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-4">
        <p className="t-overline px-5 pb-2 pt-2 text-band-muted/70">Student</p>
        {nav.map((item) => (
          <NavItem key={item.to} item={item} badge={badges[item.to]} onNavigate={onNavigate} />
        ))}

        <p className="t-overline px-5 pb-2 pt-6 text-band-muted/70">More</p>
        {secondaryNav.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {typeof completion === 'number' && (
        <div className="shrink-0 border-t border-band-rule px-5 py-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-overline text-band-muted">Profile strength</p>
            <p className="tabular font-display text-sm font-extrabold text-accent">{completion}%</p>
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-band-rule">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-brand"
              style={{ width: `${Math.max(0, Math.min(100, completion))}%` }}
            />
          </div>
          <NavLink
            to="/app/settings"
            onClick={onNavigate}
            className="t-xs mt-3 inline-block font-semibold text-band-muted underline underline-offset-4 transition-colors hover:text-band-on"
          >
            {completion >= 100 ? 'Review your profile' : 'Complete your profile'}
          </NavLink>
        </div>
      )}
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

  // Close the drawer on route change, Escape, or a jump to desktop width.
  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [mobileOpen])

  const badges: Record<string, number> = {
    '/app/scholarships': counts.matches,
    '/app/applications': counts.applications,
    '/app/notifications': counts.unread,
  }
  const unread = counts.unread

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Your account'
  const initials =
    ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase() ||
    (user?.email?.[0] || 'U').toUpperCase()
  const subLabel = user?.profile?.student_id || user?.email || ''
  const completion =
    typeof user?.profile?.profile_completion === 'number'
      ? Math.round(user.profile.profile_completion)
      : undefined

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent badges={badges} isStaff={!!user?.is_staff} completion={completion} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[86vw] flex-col shadow-overlay">
            <button
              type="button"
              className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-sm text-band-muted transition-colors hover:bg-band-rule hover:text-band-on"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              badges={badges}
              isStaff={!!user?.is_staff}
              completion={completion}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-rule bg-canvas px-3 sm:gap-3 sm:px-6">
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-sm text-ink-secondary transition-colors hover:bg-surface-sunken lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden min-w-0 flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <input
              placeholder="Search scholarships, applications, documents…"
              aria-label="Search"
              className="h-9 w-full max-w-sm rounded-md border border-rule bg-surface pl-9 pr-4 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-ink focus:outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="grid h-9 w-9 place-items-center rounded-sm text-ink-secondary transition-colors hover:bg-surface-sunken"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            <NavLink
              to="/app/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-sm text-ink-secondary transition-colors hover:bg-surface-sunken"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="tabular absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-accent-on">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>

            <span className="mx-1.5 hidden h-6 w-px bg-rule sm:block" aria-hidden />

            <NavLink
              to="/app/settings"
              className="flex items-center gap-2.5 rounded-sm py-1 pl-1 pr-2 transition-colors hover:bg-surface-sunken"
            >
              <Avatar initials={initials} className="h-8 w-8" />
              <span className="hidden min-w-0 text-left leading-tight sm:block">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">{fullName}</span>
                {subLabel && <span className="block truncate text-[0.6875rem] text-ink-muted">{subLabel}</span>}
              </span>
            </NavLink>

            <NavLink
              to="/login"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-sm text-ink-muted transition-colors hover:bg-state-negative-soft hover:text-state-negative"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </NavLink>
          </div>
        </header>

        <main
          key={location.pathname}
          className="mx-auto w-full max-w-content px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
        >
          <motion.div variants={pageEnter} initial="hidden" animate="show">
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
