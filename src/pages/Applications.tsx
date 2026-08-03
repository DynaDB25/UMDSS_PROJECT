import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, Check, Calendar, ChevronRight, Inbox } from 'lucide-react'
import { api } from '../api/endpoints'
import {
  Alert,
  ButtonLink,
  Card,
  EmptyState,
  Progress,
  Stat,
  StatRow,
  StatusPill,
  Tabs,
} from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { PageListSkeleton } from '../components/skeletons'
import { cn } from '../lib/cn'
import type { ApplicationStatus } from '../data/types'
import { listItem, stagger } from '../lib/motion'

type Tab = ApplicationStatus | 'All'

const TABS: Tab[] = [
  'All',
  'Draft',
  'Submitted',
  'Under Review',
  'Interview',
  'Awarded',
  'Rejected',
]

export default function Applications() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('All')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    api.applications
      .list()
      .then((data) => {
        setApplications(data)
        if (data.length > 0) setOpen(data[0].id)
      })
      .catch(() => setApplications([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageListSkeleton label="Loading applications" rows={4} />

  const filtered = tab === 'All' ? applications : applications.filter((a) => a.status === tab)
  const inProgress = applications.filter((a) =>
    ['Submitted', 'Under Review', 'Interview'].includes(a.status),
  ).length
  const interviews = applications.filter((a) => a.status === 'Interview').length
  const drafts = applications.filter((a) => a.status === 'Draft').length

  const tabItems = TABS.map((t) => ({
    value: t,
    label: t,
    count: t === 'All' ? applications.length : applications.filter((a) => a.status === t).length,
  }))

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-6">
        <p className="t-overline text-accent">Tracker</p>
        <h1 className="t-h1 mt-2 text-ink">My applications</h1>
        <p className="t-body mt-2 max-w-prose text-ink-muted">
          Every award you have started, from draft through to the funder&apos;s decision.
        </p>
      </header>

      <StatRow>
        <Stat label="Total applications" value={applications.length} icon={<ClipboardList />} />
        <Stat label="In progress" value={inProgress} detail="Submitted or further" />
        <Stat label="Interviews" value={interviews} tone={interviews > 0 ? 'accent' : 'ink'} />
        <Stat label="Drafts" value={drafts} detail={drafts > 0 ? 'Not sent yet' : 'None waiting'} />
      </StatRow>

      <Tabs<Tab> items={tabItems} value={tab} onChange={setTab} />

      {filtered.length > 0 ? (
        <motion.div initial="hidden" animate="show" variants={stagger(0, 0.04)} className="space-y-3">
          {filtered.map((a) => {
            const isOpen = open === a.id
            return (
              <motion.div key={a.id} variants={listItem}>
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : a.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-sunken sm:px-5"
                  >
                    <ScholarshipLogo
                      name={a.scholarshipName}
                      provider={a.provider}
                      initials={a.initials}
                      className="h-11 w-11"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-2 font-display text-[0.9375rem] font-bold leading-snug tracking-tight text-ink sm:line-clamp-1">
                          {a.scholarshipName}
                        </p>
                        <StatusPill status={a.status} />
                      </div>
                      <p className="t-sm mt-0.5 truncate text-ink-muted">
                        {a.provider} · {a.amount}
                      </p>
                      {/* Progress inline on phones, where the side column is hidden */}
                      <div className="mt-2.5 flex items-center gap-2.5 sm:hidden">
                        <Progress
                          value={a.progress}
                          size="sm"
                          className="flex-1"
                          tone={a.status === 'Awarded' ? 'positive' : a.status === 'Interview' ? 'accent' : 'ink'}
                        />
                        <span className="tabular t-xs shrink-0 font-semibold text-ink-muted">
                          {a.progress}%
                        </span>
                      </div>
                    </div>

                    <div className="hidden w-40 shrink-0 sm:block">
                      <div className="flex items-center gap-2.5">
                        <Progress
                          value={a.progress}
                          className="flex-1"
                          tone={a.status === 'Awarded' ? 'positive' : a.status === 'Interview' ? 'accent' : 'ink'}
                        />
                        <span className="tabular t-xs w-8 text-right font-semibold text-ink-muted">
                          {a.progress}%
                        </span>
                      </div>
                      <p className="t-xs mt-1.5 text-ink-muted">Updated {a.lastUpdate}</p>
                    </div>

                    <ChevronRight
                      className={cn(
                        'h-5 w-5 shrink-0 text-ink-faint transition-transform duration-[--dur]',
                        isOpen && 'rotate-90',
                      )}
                      aria-hidden
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden border-t border-rule bg-surface-sunken"
                      >
                        <div className="grid gap-8 px-4 py-6 sm:px-5 lg:grid-cols-3">
                          {/* Timeline. Guarded: an application with no steps
                              recorded would otherwise render a bare heading
                              over nothing at all. */}
                          <div className="lg:col-span-2">
                            <h3 className="t-overline text-ink-muted">Application timeline</h3>
                            {(a.timeline || []).length === 0 ? (
                              <p className="t-sm mt-3 text-ink-muted">
                                No steps recorded yet. They appear here as this application moves
                                through the funder&apos;s process.
                              </p>
                            ) : (
                            <ol className="mt-4 ml-[9px] space-y-5 border-l border-rule-strong pl-6">
                              {(a.timeline || []).map((t: any) => (
                                <li key={t.label} className="relative">
                                  <span
                                    className={cn(
                                      'absolute -left-[31px] grid h-[18px] w-[18px] place-items-center rounded-full ring-4 ring-surface-sunken',
                                      t.done
                                        ? 'bg-accent text-accent-on'
                                        : 'border border-rule-strong bg-surface text-transparent',
                                    )}
                                    aria-hidden
                                  >
                                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                                  </span>
                                  <p
                                    className={cn(
                                      'text-sm font-semibold',
                                      t.done ? 'text-ink' : 'text-ink-muted',
                                    )}
                                  >
                                    {t.label}
                                  </p>
                                  <p className="tabular t-xs mt-0.5 text-ink-muted">{t.date}</p>
                                </li>
                              ))}
                            </ol>
                            )}
                          </div>

                          {/* Side panel */}
                          <div className="space-y-3">
                            {a.status === 'Draft' && (
                              <Alert tone="warning" title="Not submitted yet">
                                Your pack is ready. Send it to {a.provider} on their own form, then
                                mark it submitted.
                              </Alert>
                            )}

                            {a.status === 'Interview' && (
                              <div className="rounded-md border border-state-special/30 bg-state-special-soft p-4">
                                <p className="flex items-center gap-2 text-sm font-semibold text-state-special">
                                  <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                                  Interview stage
                                </p>
                                <p className="t-sm mt-1.5 text-state-special/85">
                                  {a.provider} will contact you with the date and venue. Watch your
                                  SMS alerts.
                                </p>
                                <ButtonLink
                                  to="/app/assistant"
                                  size="sm"
                                  block
                                  className="mt-3 bg-state-special text-white hover:bg-state-special/85"
                                >
                                  Prepare with the bot
                                </ButtonLink>
                              </div>
                            )}

                            {Array.isArray(a.attachedDocuments) && a.attachedDocuments.length > 0 && (
                              <Card className="p-4">
                                <p className="t-overline text-ink-muted">Documents</p>
                                <ul className="mt-2.5 space-y-2">
                                  {a.attachedDocuments.map((doc: any, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2.5">
                                      <span
                                        className={cn(
                                          'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                                          doc.have
                                            ? 'border-state-positive bg-state-positive text-white'
                                            : 'border-rule-strong text-transparent',
                                        )}
                                        aria-hidden
                                      >
                                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                                      </span>
                                      <span
                                        className={cn(
                                          't-xs min-w-0 flex-1',
                                          doc.have ? 'text-ink' : 'text-ink-muted',
                                        )}
                                      >
                                        {doc.requirement}
                                        {doc.have && doc.name && (
                                          <span className="mt-0.5 block truncate text-state-positive">
                                            {doc.name}
                                          </span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </Card>
                            )}

                            {a.submittedOn && a.submittedOn !== '-' && (
                              <Card className="p-4">
                                <p className="t-overline text-ink-muted">Submitted on</p>
                                <p className="tabular mt-1 text-sm font-semibold text-ink">
                                  {a.submittedOn}
                                </p>
                              </Card>
                            )}

                            <ButtonLink
                              to={`/app/scholarships/${a.scholarshipId}`}
                              variant="subtle"
                              block
                            >
                              {a.status === 'Draft' ? 'Continue application' : 'View scholarship'}
                            </ButtonLink>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No applications yet"
          description="When you apply to a scholarship it shows up here so you can track it end to end, from submission through to the final decision."
          action={
            <ButtonLink to="/app/scholarships" variant="accent">
              Browse your matches
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={<Inbox />}
          title={`Nothing under “${tab}”`}
          description="You have no applications with this status yet."
          action={
            <button
              type="button"
              onClick={() => setTab('All')}
              className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
            >
              Show all applications
            </button>
          }
        />
      )}
    </div>
  )
}
