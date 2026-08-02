import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, CheckCircle2, Circle, Calendar, ChevronRight } from 'lucide-react'
import { api } from '../api/endpoints'
import { Card, StatusPill, Progress } from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { cn } from '../lib/cn'
import type { ApplicationStatus } from '../data/types'

const tabs: (ApplicationStatus | 'All')[] = ['All', 'Draft', 'Submitted', 'Under Review', 'Interview', 'Awarded']

export default function Applications() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof tabs)[number]>('All')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    api.applications.list().then(data => {
      setApplications(data)
      if (data.length > 0) setOpen(data[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = tab === 'All' ? applications : applications.filter((a) => a.status === tab)

  const summary = [
    { label: 'Total applications', value: applications.length, tone: 'text-ink-900' },
    { label: 'In progress', value: applications.filter((a) => ['Submitted', 'Under Review', 'Interview'].includes(a.status)).length, tone: 'text-amber-600' },
    { label: 'Interviews', value: applications.filter((a) => a.status === 'Interview').length, tone: 'text-violet-600' },
    { label: 'Drafts', value: applications.filter((a) => a.status === 'Draft').length, tone: 'text-ink-500' },
  ]
  
  if (loading) return <div>Loading applications...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-brand-600" />
        <h1 className="font-display text-2xl font-extrabold text-ink-900">My Applications</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label} className="p-5">
            <p className={cn('font-display text-3xl font-extrabold', s.tone)}>{s.value}</p>
            <p className="mt-1 text-sm text-ink-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-xl px-3.5 py-2 text-sm font-medium transition',
              tab === t
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.map((a, i) => {
          const isOpen = open === a.id
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Card className="overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : a.id)}
                  className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-ink-50/50"
                >
                  <ScholarshipLogo scholarshipId={a.scholarshipId} initials={a.initials} color={a.logoColor} className="h-12 w-12 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900">{a.scholarshipName}</p>
                      <StatusPill status={a.status} />
                    </div>
                    <p className="text-sm text-ink-500">{a.provider} · {a.amount}</p>
                  </div>
                  <div className="hidden w-40 sm:block">
                    <div className="flex items-center gap-2">
                      <Progress value={a.progress} tone={a.status === 'Interview' ? 'gold' : a.status === 'Awarded' ? 'green' : 'brand'} />
                      <span className="text-xs font-medium text-ink-400">{a.progress}%</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">Updated {a.lastUpdate}</p>
                  </div>
                  <ChevronRight className={cn('h-5 w-5 text-ink-400 transition', isOpen && 'rotate-90')} />
                </button>

                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-ink-100 bg-ink-50/40 px-5 py-6"
                  >
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="lg:col-span-2">
                        <h3 className="mb-4 text-sm font-semibold text-ink-700">Application timeline</h3>
                        <ol className="relative ml-1 space-y-5 border-l-2 border-ink-200 pl-6">
                          {a.timeline.map((t: any) => (
                            <li key={t.label} className="relative">
                              <span
                                className={cn(
                                  'absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full ring-4 ring-ink-50',
                                  t.done ? 'bg-emerald-500 text-white' : 'bg-white text-ink-300 ring-2 ring-ink-200',
                                )}
                              >
                                {t.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                              </span>
                              <p className={cn('text-sm font-semibold', t.done ? 'text-ink-800' : 'text-ink-500')}>
                                {t.label}
                              </p>
                              <p className="text-xs text-ink-400">{t.date}</p>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="space-y-3">
                        {a.status === 'Interview' && (
                          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                              <Calendar className="h-4 w-4" /> Interview scheduled
                            </div>
                            <p className="mt-1 text-sm text-violet-700">Thu 03 Jul 2026 · 10:00 AM</p>
                            <p className="text-xs text-violet-600">MTN House, Ridge, Accra</p>
                            <button className="mt-3 w-full rounded-lg bg-violet-700 py-2 text-xs font-semibold text-white">
                              Prepare with the bot
                            </button>
                          </div>
                        )}
                        <div className="rounded-xl bg-white p-4 ring-1 ring-ink-200">
                          <p className="text-xs text-ink-400">Submitted on</p>
                          <p className="text-sm font-semibold text-ink-800">{a.submittedOn}</p>
                        </div>
                        <button className="w-full rounded-xl border border-ink-200 bg-white py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
                          {a.status === 'Draft' ? 'Continue application' : 'View submitted application'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
