import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ClipboardList,
  Wallet,
  CalendarClock,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Bot,
  FileText,
} from 'lucide-react'
import { Card, Avatar, StatusPill, Progress, ScoreRing } from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import {
  daysUntil,
  formatDeadline,
} from '../data/mock'
import type { MatchResult, Application, Scholarship, AppNotification } from '../data/types'
import { cn } from '../lib/cn'

export default function Dashboard() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [scholarships, setScholarships] = useState<Scholarship[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.matches.list(),
      api.scholarships.list(),
      api.applications.list(),
      api.notifications.list(),
    ]).then(([m, s, a, n]) => {
      setMatches(m)
      setScholarships(s)
      setApplications(a)
      setNotifications(n)
    }).finally(() => setLoading(false))
  }, [])

  if (loading || !user) return <div className="p-8 text-center text-ink-500">Loading dashboard...</div>

  const eligible = matches.filter((m: MatchResult) => m.status !== 'Not eligible')
  const topMatches = [...eligible].sort((a, b) => b.score - a.score).slice(0, 3)
  // Only scholarships with a stated, unexpired deadline belong in a
  // "closing soon" rail — null deadlines mean the provider doesn't publish one.
  const upcoming = scholarships
    .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .slice(0, 4)
  const funding = eligible.reduce((sum, m) => sum + (m.scholarship.amountValue || 0), 0)
  const fundingLabel = funding >= 1000 ? `GH₵ ${Math.round(funding / 1000)}k` : `GH₵ ${funding}`

  const stats = [
    { label: 'Eligible matches', value: String(eligible.length), sub: `${eligible.filter((m: MatchResult) => m.status === 'Strong match').length} strong`, icon: Sparkles, tone: 'bg-brand-50 text-brand-700' },
    { label: 'Active applications', value: String(applications.length), sub: `${applications.filter((a: Application) => a.status === 'Interview').length} in interview`, icon: ClipboardList, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Potential funding', value: fundingLabel, sub: 'across matches', icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Next deadline', value: upcoming.length > 0 ? `${daysUntil(upcoming[0].deadline)} days` : 'N/A', sub: upcoming.length > 0 ? upcoming[0].name : '', icon: CalendarClock, tone: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-8"
      >
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 right-24 h-52 w-52 rounded-full bg-gold-500/10" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-brand-200">Good morning,</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
              {user.first_name} {user.last_name} 👋
            </h1>
            <p className="mt-2 max-w-md text-sm text-brand-100">
              Your profile is <span className="font-semibold text-gold-300">{user.profile?.profile_completion || 0}% complete</span>.
              {(() => {
                const n = applications.filter((a: Application) => a.status === 'Interview').length
                return n > 0 ? ` You have ${n} interview${n > 1 ? 's' : ''} coming up.` : ''
              })()}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                to="/app/matches"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
              >
                <Sparkles className="h-4 w-4" /> View matches
              </Link>
              <Link
                to="/app/assistant"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Bot className="h-4 w-4" /> Ask the bot
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <div className="relative grid place-items-center">
              <svg width="72" height="72" className="-rotate-90">
                <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 30}
                  strokeDashoffset={2 * Math.PI * 30 * (1 - 0.92)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-display text-lg font-bold">{user.profile?.profile_completion || 92}%</span>
            </div>
            <div className="text-sm">
              <p className="font-semibold">Profile strength</p>
              <p className="text-brand-200">Add a leadership essay</p>
              <Link to="/app/settings" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-300">
                Complete now <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <div className={cn('grid h-10 w-10 place-items-center rounded-xl', s.tone)}>
                  <s.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-ink-300" />
              </div>
              <p className="mt-4 font-display text-2xl font-extrabold text-ink-900">{s.value}</p>
              <p className="text-sm text-ink-500">{s.label}</p>
              <p className="mt-1 text-xs font-medium text-ink-400">{s.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top matches */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-ink-900">Top scholarship matches</h2>
                <p className="text-sm text-ink-500">Ranked by how well your profile fits</p>
              </div>
              <Link to="/app/matches" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                See all
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {topMatches.map((m: MatchResult) => (
                <Link
                  key={m.scholarship.id}
                  to={`/app/matches/${m.scholarship.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-ink-200/70 p-3.5 transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <ScholarshipLogo scholarshipId={m.scholarship.id} initials={m.scholarship.initials} color={m.scholarship.logoColor} className="h-12 w-12 rounded-xl text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-ink-900">{m.scholarship.name}</p>
                      <StatusPill status={m.status} />
                    </div>
                    <p className="truncate text-sm text-ink-500">{m.scholarship.provider}</p>
                    <p className="mt-0.5 text-sm font-medium text-emerald-700">{m.scholarship.amount}</p>
                  </div>
                  <div className="hidden sm:block">
                    <ScoreRing score={m.score} />
                  </div>
                  <ArrowRight className="h-5 w-5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              ))}
            </div>
          </Card>

          {/* Active applications */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-900">Application progress</h2>
              <Link to="/app/applications" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Manage
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              {applications.slice(0, 3).map((a: Application) => (
                <div key={a.id} className="flex items-center gap-4">
                  <ScholarshipLogo scholarshipId={a.scholarshipId} initials={a.initials} color={a.logoColor} className="h-10 w-10 rounded-xl text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink-800">{a.scholarshipName}</p>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={a.progress} className="flex-1" tone={a.status === 'Interview' ? 'gold' : 'brand'} />
                      <span className="text-xs font-medium text-ink-400">{a.progress}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Deadlines */}
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-ink-900">Upcoming deadlines</h2>
            <div className="mt-4 space-y-3">
              {upcoming.map((s) => {
                const d = daysUntil(s.deadline)
                const urgent = d <= 7
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div
                      className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center',
                        urgent ? 'bg-rose-50 text-rose-600' : 'bg-ink-50 text-ink-500',
                      )}
                    >
                      <span className="text-base font-bold leading-none">{d}</span>
                      <span className="text-[9px] font-semibold uppercase">days</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-800">{s.name}</p>
                      <p className="text-xs text-ink-400">{formatDeadline(s.deadline)}</p>
                    </div>
                    {urgent && <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Activity */}
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-ink-900">Recent activity</h2>
            <div className="mt-4 space-y-4">
              {notifications.slice(0, 4).map((n: AppNotification) => (
                <div key={n.id} className="flex gap-3">
                  <div
                    className={cn(
                      'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                      n.category === 'Interview' && 'bg-violet-50 text-violet-600',
                      n.category === 'Deadline' && 'bg-rose-50 text-rose-600',
                      n.category === 'Status' && 'bg-emerald-50 text-emerald-600',
                      n.category === 'Match' && 'bg-brand-50 text-brand-600',
                      n.category === 'System' && 'bg-ink-100 text-ink-500',
                    )}
                  >
                    {n.category === 'Status' ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800">{n.title}</p>
                    <p className="text-xs text-ink-400">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/app/notifications"
              className="mt-4 block text-center text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              View all notifications
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
