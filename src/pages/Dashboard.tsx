import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ClipboardList,
  Wallet,
  CalendarClock,
  ArrowRight,
  AlertTriangle,
  Bot,
  BellRing,
  Inbox,
} from 'lucide-react'
import {
  ButtonLink,
  Card,
  EmptyState,
  Progress,
  ScoreRing,
  SectionLabel,
  Stat,
  StatRow,
  StatusPill,
} from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { DashboardSkeleton } from '../components/skeletons'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { daysUntil, formatDeadline } from '../data/mock'
import type { MatchResult, Application, Scholarship, AppNotification } from '../data/types'
import { cn } from '../lib/cn'
import { fadeUp, listItem, stagger } from '../lib/motion'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [scholarships, setScholarships] = useState<Scholarship[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.matches.list().catch(() => []),
      api.scholarships.list().catch(() => []),
      api.applications.list().catch(() => []),
      api.notifications.list().catch(() => []),
    ])
      .then(([m, s, a, n]) => {
        setMatches(m)
        setScholarships(s)
        setApplications(a)
        setNotifications(n)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !user) return <DashboardSkeleton />

  const eligible = matches.filter((m) => m.status !== 'Not eligible')
  const strong = eligible.filter((m) => m.status === 'Strong match').length
  const topMatches = [...eligible].sort((a, b) => b.score - a.score).slice(0, 3)
  // Only scholarships with a stated, unexpired deadline belong in a
  // "closing soon" rail, null deadlines mean the provider doesn't publish one.
  const upcoming = scholarships
    .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .slice(0, 4)
  const funding = eligible.reduce((sum, m) => sum + (m.scholarship.amountValue || 0), 0)
  const fundingLabel = funding >= 1000 ? `GH₵ ${Math.round(funding / 1000)}k` : `GH₵ ${funding}`
  const interviews = applications.filter((a) => a.status === 'Interview').length
  const completion = Math.max(0, Math.min(100, Math.round(user.profile?.profile_completion ?? 0)))

  return (
    <div className="space-y-10">
      {/* ---------------- Greeting band ---------------- */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="rounded-md bg-band px-5 py-6 sm:px-7 sm:py-8"
      >
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="t-overline text-accent">{greeting()}</p>
            <h1 className="t-display-md mt-2 text-balance text-band-on">
              {user.first_name} {user.last_name}
            </h1>
            <p className="t-body mt-3 max-w-md text-band-muted">
              {eligible.length > 0
                ? `You qualify for ${eligible.length} award${eligible.length > 1 ? 's' : ''} right now.`
                : 'Complete your profile and the matching engine will start ranking awards for you.'}
              {interviews > 0 &&
                ` You have ${interviews} interview${interviews > 1 ? 's' : ''} coming up.`}
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <ButtonLink to="/app/scholarships" variant="accent" icon={<Sparkles className="h-4 w-4" />}>
                View my matches
              </ButtonLink>
              <ButtonLink to="/app/assistant" variant="onBand" icon={<Bot className="h-4 w-4" />}>
                Ask the bot
              </ButtonLink>
            </div>
          </div>

          {/* Profile strength, the real value, not a decorative arc */}
          <div className="flex shrink-0 items-center gap-5 border-t border-band-rule pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <ScoreRing score={completion} size={72} className="[&_span]:text-band-on" />
            <div className="min-w-0">
              <p className="t-overline text-band-muted">Profile strength</p>
              <p className="t-body mt-1.5 max-w-[16rem] text-band-on">
                {completion >= 100
                  ? 'Your profile is complete.'
                  : 'A fuller profile unlocks more matches.'}
              </p>
              {completion < 100 && (
                <Link
                  to="/app/settings"
                  className="t-sm mt-2 inline-flex items-center gap-1.5 font-semibold text-accent underline underline-offset-4"
                >
                  Complete it now
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ---------------- Stats ---------------- */}
      <StatRow>
        <Stat
          label="Eligible matches"
          value={eligible.length}
          detail={`${strong} strong`}
          icon={<Sparkles />}
        />
        <Stat
          label="Active applications"
          value={applications.length}
          detail={interviews > 0 ? `${interviews} in interview` : 'None in interview'}
          icon={<ClipboardList />}
        />
        <Stat
          label="Potential funding"
          value={fundingLabel}
          detail="Across your matches"
          tone="accent"
          icon={<Wallet />}
        />
        <Stat
          label="Next deadline"
          value={upcoming.length > 0 ? `${daysUntil(upcoming[0].deadline)}d` : '-'}
          detail={upcoming.length > 0 ? upcoming[0].name : 'Nothing scheduled'}
          icon={<CalendarClock />}
        />
      </StatRow>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ---------------- Main column ---------------- */}
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionLabel
              action={
                <Link
                  to="/app/scholarships"
                  className="t-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
                >
                  See all
                </Link>
              }
            >
              Top matches
            </SectionLabel>

            {topMatches.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="show"
                variants={stagger(0.05, 0.05)}
                className="rule-list mt-3 overflow-hidden rounded-md border border-rule bg-surface"
              >
                {topMatches.map((m) => (
                  <motion.div key={m.scholarship.id} variants={listItem}>
                    <Link
                      to={`/app/scholarships/${m.scholarship.id}`}
                      className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-sunken sm:px-5"
                    >
                      <ScholarshipLogo
                        name={m.scholarship.name}
                        provider={m.scholarship.provider}
                        initials={m.scholarship.initials}
                        className="h-11 w-11"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-display text-[0.9375rem] font-bold tracking-tight text-ink transition-colors group-hover:text-accent">
                            {m.scholarship.name}
                          </p>
                          <StatusPill status={m.status} />
                        </div>
                        <p className="t-sm mt-0.5 truncate text-ink-muted">
                          {m.scholarship.provider}
                        </p>
                        <p className="tabular t-sm mt-1 font-bold text-ink">{m.scholarship.amount}</p>
                      </div>
                      <ScoreRing score={m.score} size={48} className="hidden sm:grid" />
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                        aria-hidden
                      />
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <EmptyState
                className="mt-3"
                icon={<Sparkles />}
                title="No matches yet"
                description="Add your WASSCE aggregate, programme and home region so the engine can rank awards for you."
                action={
                  <ButtonLink to="/app/settings" variant="accent">
                    Complete my profile
                  </ButtonLink>
                }
              />
            )}
          </section>

          <section>
            <SectionLabel
              action={
                <Link
                  to="/app/applications"
                  className="t-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
                >
                  Manage
                </Link>
              }
            >
              Application progress
            </SectionLabel>

            {applications.length > 0 ? (
              <Card className="mt-3">
                <ul className="rule-list">
                  {applications.slice(0, 3).map((a) => (
                    <li key={a.id} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                      <ScholarshipLogo
                        name={a.scholarshipName}
                        provider={a.provider}
                        initials={a.initials}
                        className="h-10 w-10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-ink">
                            {a.scholarshipName}
                          </p>
                          <StatusPill status={a.status} className="shrink-0" />
                        </div>
                        <div className="mt-2.5 flex items-center gap-3">
                          <Progress
                            value={a.progress}
                            className="flex-1"
                            tone={a.status === 'Interview' ? 'accent' : 'ink'}
                          />
                          <span className="tabular t-xs w-8 shrink-0 text-right font-semibold text-ink-muted">
                            {a.progress}%
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState
                className="mt-3"
                icon={<ClipboardList />}
                title="No applications yet"
                description="Start one from any scholarship you qualify for and track it here."
                action={
                  <ButtonLink to="/app/scholarships" variant="accent">
                    Browse scholarships
                  </ButtonLink>
                }
              />
            )}
          </section>
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-8">
          <section>
            <SectionLabel>Upcoming deadlines</SectionLabel>
            {upcoming.length > 0 ? (
              <Card className="mt-3">
                <ul className="rule-list">
                  {upcoming.map((s) => {
                    const d = daysUntil(s.deadline)
                    const urgent = d <= 7
                    return (
                      <li key={s.id}>
                        <Link
                          to={`/app/scholarships/${s.id}`}
                          className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-sunken"
                        >
                          <div
                            className={cn(
                              'grid h-11 w-11 shrink-0 place-items-center rounded-sm border text-center',
                              urgent
                                ? 'border-state-negative/40 bg-state-negative-soft text-state-negative'
                                : 'border-rule text-ink-secondary',
                            )}
                          >
                            <span className="tabular text-base font-bold leading-none">{d}</span>
                            <span className="text-[0.5625rem] font-semibold uppercase tracking-wide">
                              days
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.8125rem] font-semibold text-ink">
                              {s.name}
                            </p>
                            <p className="tabular t-xs text-ink-muted">
                              {formatDeadline(s.deadline)}
                            </p>
                          </div>
                          {urgent && (
                            <AlertTriangle
                              className="h-4 w-4 shrink-0 text-state-negative"
                              aria-label="Closing soon"
                            />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            ) : (
              <EmptyState
                className="mt-3 py-10"
                icon={<CalendarClock />}
                title="No deadlines listed"
                description="Nothing with a published closing date right now."
              />
            )}
          </section>

          <section>
            <SectionLabel
              action={
                <Link
                  to="/app/notifications"
                  className="t-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
                >
                  View all
                </Link>
              }
            >
              Recent activity
            </SectionLabel>

            {notifications.length > 0 ? (
              <Card className="mt-3">
                <ul className="rule-list">
                  {notifications.slice(0, 4).map((n) => (
                    <li key={n.id} className="flex gap-3 px-4 py-3.5">
                      <span
                        className={cn(
                          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm border',
                          n.category === 'Deadline' && 'border-state-negative/30 text-state-negative',
                          n.category === 'Interview' && 'border-state-special/30 text-state-special',
                          n.category === 'Status' && 'border-state-positive/30 text-state-positive',
                          n.category === 'Match' && 'border-accent/40 text-accent',
                          n.category === 'System' && 'border-rule text-ink-muted',
                        )}
                        aria-hidden
                      >
                        <BellRing className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-medium leading-snug text-ink">{n.title}</p>
                        <p className="t-xs mt-0.5 text-ink-muted">{n.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState
                className="mt-3 py-10"
                icon={<Inbox />}
                title="Nothing yet"
                description="Deadline and status alerts will appear here."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
