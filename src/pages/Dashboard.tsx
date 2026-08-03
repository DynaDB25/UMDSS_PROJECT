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
  Upload,
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
import { formatCedis, formatDaysLeft, formatDaysShort, isUrgent } from '../lib/format'
import type { MatchResult, Application, Scholarship, AppNotification } from '../data/types'
import { cn } from '../lib/cn'
import { fadeUp, listItem, stagger } from '../lib/motion'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** What the student should actually do about an application, in three words. */
function nextAction(status: string): string {
  switch (status) {
    case 'Draft':
      return 'Finish and submit'
    case 'Submitted':
      return 'Waiting on the funder'
    case 'Under Review':
      return 'Under review'
    case 'Interview':
      return 'Prepare for interview'
    case 'Awarded':
      return 'Awarded'
    case 'Rejected':
      return 'Closed'
    default:
      return 'In progress'
  }
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

  // Scores bunch at the top once a profile is complete, so a pure score sort
  // shows three identical rings. Break ties by whichever closes first, which
  // is the thing that actually decides what to do next.
  // An award that has already closed is not a top match, whatever it scores.
  const stillOpen = (m: MatchResult) => {
    const d = daysUntil(m.scholarship.deadline)
    return !Number.isFinite(d) || d >= 0
  }
  const topMatches = [...eligible]
    .sort((a, b) => {
      const openA = stillOpen(a)
      const openB = stillOpen(b)
      if (openA !== openB) return openA ? -1 : 1
      if (b.score !== a.score) return b.score - a.score
      return daysUntil(a.scholarship.deadline) - daysUntil(b.scholarship.deadline)
    })
    .slice(0, 4)

  // Only awards with a stated, unexpired deadline belong in a countdown.
  const upcoming = scholarships
    .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
  const closingNow = eligible
    .filter((m) => isUrgent(daysUntil(m.scholarship.deadline)))
    .sort((a, b) => daysUntil(a.scholarship.deadline) - daysUntil(b.scholarship.deadline))

  const funding = eligible.reduce((sum, m) => sum + (m.scholarship.amountValue || 0), 0)
  const interviews = applications.filter((a) => a.status === 'Interview').length
  const drafts = applications.filter((a) => a.status === 'Draft').length
  const completion = Math.max(0, Math.min(100, Math.round(user.profile?.profile_completion ?? 0)))
  const nextDeadlineDays = upcoming.length > 0 ? daysUntil(upcoming[0].deadline) : NaN

  return (
    <div className="space-y-8">
      {/* ---------------- Greeting ---------------- */}
      <motion.header
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-rule pb-6"
      >
        <div className="min-w-0">
          <p className="t-overline text-accent">{greeting()}</p>
          <h1 className="t-h1 mt-2 text-ink">
            {user.first_name} {user.last_name}
          </h1>
          <p className="t-body mt-2 text-ink-muted">
            {eligible.length > 0
              ? `You qualify for ${eligible.length} award${eligible.length === 1 ? '' : 's'}.`
              : 'Complete your profile and the matching engine will start ranking awards for you.'}
            {drafts > 0 && ` ${drafts} application${drafts === 1 ? '' : 's'} still in draft.`}
            {interviews > 0 && ` ${interviews} interview${interviews === 1 ? '' : 's'} coming up.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {completion < 100 && (
            <ButtonLink to="/app/settings" variant="subtle" icon={<Upload className="h-4 w-4" />}>
              Complete profile · {completion}%
            </ButtonLink>
          )}
          <ButtonLink to="/app/scholarships" variant="accent" icon={<Sparkles className="h-4 w-4" />}>
            View my matches
          </ButtonLink>
          <ButtonLink to="/app/assistant" variant="outline" icon={<Bot className="h-4 w-4" />}>
            Ask the bot
          </ButtonLink>
        </div>
      </motion.header>

      {/* ---------------- Closing this week ----------------
          The product exists because students miss deadlines, so anything
          inside a week leads the page rather than sitting in a side rail. */}
      {closingNow.length > 0 && (
        <motion.section
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="overflow-hidden rounded-md bg-band"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-band-rule px-5 py-3.5">
            <p className="t-overline flex items-center gap-2 text-accent">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Closing within a week
            </p>
            <p className="tabular t-xs text-band-muted">
              {closingNow.length} of your matches
            </p>
          </div>
          <ul className="divide-y divide-band-rule">
            {closingNow.slice(0, 3).map((m) => {
              const d = daysUntil(m.scholarship.deadline)
              return (
                <li key={m.scholarship.id}>
                  <Link
                    to={`/app/scholarships/${m.scholarship.id}`}
                    className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-band-rule/40 sm:items-center sm:gap-4 sm:px-5"
                  >
                    <span className="tabular w-14 shrink-0 pt-0.5 font-display text-[0.8125rem] font-extrabold uppercase leading-tight text-accent sm:w-16 sm:pt-0 sm:text-sm sm:normal-case">
                      {formatDaysLeft(d)}
                    </span>
                    <span className="min-w-0 flex-1">
                      {/* Two lines on a phone: these titles are long, and one
                          truncated line tells the student nothing. */}
                      <span className="line-clamp-2 text-sm font-semibold leading-snug text-band-on sm:line-clamp-1 sm:text-[0.9375rem]">
                        {m.scholarship.name}
                      </span>
                      <span className="t-xs mt-1 block truncate text-band-muted">
                        {m.scholarship.provider} · {m.scholarship.amount}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-band-muted transition-all group-hover:translate-x-0.5 group-hover:text-band-on sm:mt-0"
                      aria-hidden
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </motion.section>
      )}

      {/* ---------------- Stats ---------------- */}
      <StatRow>
        <Stat
          label="Eligible matches"
          value={eligible.length}
          detail={`${strong} strong match${strong === 1 ? '' : 'es'}`}
          icon={<Sparkles />}
        />
        <Stat
          label="Active applications"
          value={applications.length}
          detail={drafts > 0 ? `${drafts} still in draft` : 'None in draft'}
          icon={<ClipboardList />}
        />
        <Stat
          label="Potential funding"
          value={formatCedis(funding)}
          detail="Across your matches"
          tone="accent"
          icon={<Wallet />}
        />
        <Stat
          label="Next deadline"
          value={formatDaysLeft(nextDeadlineDays)}
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
                {topMatches.map((m) => {
                  const d = daysUntil(m.scholarship.deadline)
                  return (
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
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="line-clamp-1 font-display text-[0.9375rem] font-bold tracking-tight text-ink transition-colors group-hover:text-accent">
                              {m.scholarship.name}
                            </p>
                            <StatusPill status={m.status} />
                          </div>
                          <p className="t-sm mt-0.5 truncate text-ink-muted">
                            {m.scholarship.provider}
                          </p>
                          {/* Amount and deadline together: neither is useful alone */}
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="tabular text-[0.8125rem] font-bold text-ink">
                              {m.scholarship.amount}
                            </span>
                            <span
                              className={cn(
                                'tabular t-xs font-semibold',
                                isUrgent(d) ? 'text-state-negative' : 'text-ink-muted',
                              )}
                            >
                              {/* "Closes closed" is what happens when you
                                  blindly prefix a state word. */}
                              {!Number.isFinite(d)
                                ? 'No stated deadline'
                                : d < 0
                                  ? 'Closed'
                                  : `Closes ${formatDaysLeft(d).toLowerCase()}`}
                            </span>
                          </p>
                        </div>
                        <ScoreRing score={m.score} size={44} className="hidden sm:grid" />
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                          aria-hidden
                        />
                      </Link>
                    </motion.div>
                  )
                })}
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
              Your applications
            </SectionLabel>

            {applications.length > 0 ? (
              <Card className="mt-3">
                <ul className="rule-list">
                  {applications.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/app/scholarships/${a.scholarshipId}`}
                        className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-sunken sm:px-5"
                      >
                        <ScholarshipLogo
                          name={a.scholarshipName}
                          provider={a.provider}
                          initials={a.initials}
                          className="h-10 w-10"
                        />
                        <div className="min-w-0 flex-1">
                          {/* The pill drops below the title on a phone rather
                              than squeezing it down to "KNUST Internal...". */}
                          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink sm:line-clamp-1">
                              {a.scholarshipName}
                            </p>
                            <StatusPill status={a.status} className="shrink-0" />
                          </div>
                          {/* What to do about it, not just how far along it is */}
                          <div className="mt-2 flex items-center gap-3">
                            <Progress
                              value={a.progress}
                              className="flex-1"
                              tone={a.status === 'Awarded' ? 'positive' : a.status === 'Interview' ? 'accent' : 'ink'}
                            />
                            <span className="t-xs w-32 shrink-0 truncate text-right font-semibold text-ink-muted">
                              {nextAction(a.status)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState
                className="mt-3"
                icon={<ClipboardList />}
                title="No applications yet"
                description="Start one from any award you qualify for and track it end to end here."
                action={
                  <ButtonLink to="/app/scholarships" variant="accent">
                    Browse my matches
                  </ButtonLink>
                }
              />
            )}
          </section>
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-8">
          <section>
            <SectionLabel>Profile strength</SectionLabel>
            <Card className="mt-3 flex items-center gap-5 px-5 py-5">
              <ScoreRing
                score={completion}
                size={64}
                label="Profile completion"
                tone={completion >= 100 ? undefined : 'accent'}
              />
              <div className="min-w-0">
                <p className="t-body text-ink">
                  {completion >= 100
                    ? 'Your profile is complete.'
                    : 'A fuller profile unlocks more matches.'}
                </p>
                {completion < 100 && (
                  <Link
                    to="/app/settings"
                    className="t-sm mt-1.5 inline-flex items-center gap-1.5 font-semibold text-ink underline underline-offset-4 hover:text-accent"
                  >
                    Finish it
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </Card>
          </section>

          <section>
            <SectionLabel>Upcoming deadlines</SectionLabel>
            {upcoming.length > 0 ? (
              <Card className="mt-3">
                <ul className="rule-list">
                  {upcoming.slice(0, 5).map((s) => {
                    const d = daysUntil(s.deadline)
                    const urgent = isUrgent(d)
                    const { value, unit } = formatDaysShort(d)
                    return (
                      <li key={s.id}>
                        <Link
                          to={`/app/scholarships/${s.id}`}
                          className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-sunken"
                        >
                          <div
                            className={cn(
                              'grid h-11 w-11 shrink-0 place-items-center rounded-sm border text-center leading-none',
                              urgent
                                ? 'border-state-negative/40 bg-state-negative-soft text-state-negative'
                                : 'border-rule text-ink-secondary',
                            )}
                          >
                            <span
                              className={cn(
                                'tabular font-bold',
                                value === 'Today' ? 'text-[0.625rem] uppercase' : 'text-base',
                              )}
                            >
                              {value}
                            </span>
                            {unit && (
                              <span className="text-[0.5625rem] font-semibold uppercase tracking-wide">
                                {unit}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            {/* These titles run very long, so clamp rather than
                                letting one award own the whole rail. */}
                            <p className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-ink">
                              {s.name}
                            </p>
                            <p className="tabular t-xs mt-1 text-ink-muted">
                              {formatDeadline(s.deadline)}
                            </p>
                          </div>
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
                notifications.length > 0 ? (
                  <Link
                    to="/app/notifications"
                    className="t-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
                  >
                    View all
                  </Link>
                ) : undefined
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
                        <p className="line-clamp-2 text-[0.8125rem] font-medium leading-snug text-ink">
                          {n.title}
                        </p>
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
                description="Deadline and status alerts land here as they are sent."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
