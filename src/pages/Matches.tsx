import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../api/endpoints'
import type { MatchResult } from '../data/types'
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Users,
  ArrowRight,
  SlidersHorizontal,
  Search,
} from 'lucide-react'
import { Card, StatusPill, ScoreRing, Badge, UnverifiedBadge } from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { daysUntil, formatDeadline } from '../data/mock'
import { cn } from '../lib/cn'

const filters = ['All matches', 'Strong match', 'Partial match', 'Government', 'Corporate', 'International'] as const

export default function Matches() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All matches')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [scanned, setScanned] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.matches.list(), api.scholarships.list()])
      .then(([m, s]) => {
        setMatches(m)
        setScanned(s.length)
      })
      .finally(() => setLoading(false))
  }, [])
  
  if (loading) return <div>Loading matches...</div>

  const qualifying = matches.filter((m) => m.status !== 'Not eligible')
  const potentialFunding = qualifying.reduce((sum, m) => sum + (m.scholarship.amountValue || 0), 0)

  const filtered = matches.filter((m) => {
    const matchesFilter =
      filter === 'All matches' ||
      m.status === filter ||
      m.scholarship.providerType === filter
    const matchesQuery =
      !query ||
      m.scholarship.name.toLowerCase().includes(query.toLowerCase()) ||
      m.scholarship.provider.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Scholarship Matches</h1>
        </div>
        <p className="text-ink-500">
          Ranked using your WASSCE aggregate, programme, region and financial need. Every result shows
          exactly why you do or do not qualify.
        </p>
      </div>

      {/* Engine summary banner */}
      <Card className="overflow-hidden">
        <div className="grid divide-y divide-ink-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: 'Scholarships scanned', value: `${scanned}` },
            { label: 'You qualify for', value: `${qualifying.length}`, accent: true },
            { label: 'Total potential funding', value: `GH₵ ${potentialFunding.toLocaleString()}`, accent: true },
          ].map((s) => (
            <div key={s.label} className="p-5">
              <p className="text-sm text-ink-500">{s.label}</p>
              <p className={cn('mt-1 font-display text-2xl font-extrabold', s.accent ? 'text-brand-700' : 'text-ink-900')}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-sm font-medium transition',
                filter === f
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search awards…"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-56"
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4">
        {filtered.map((m, i) => {
          const d = daysUntil(m.scholarship.deadline)
          return (
            <motion.div
              key={m.scholarship.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Card className="p-5 transition hover:shadow-md hover:shadow-ink-900/5">
                <div className="flex flex-col gap-5 lg:flex-row">
                  {/* Left: identity */}
                  <div className="flex flex-1 gap-4">
                    <ScholarshipLogo name={m.scholarship.name} provider={m.scholarship.provider} initials={m.scholarship.initials} color={m.scholarship.logoColor} className="h-14 w-14 rounded-2xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/app/matches/${m.scholarship.id}`}
                          className="font-display text-lg font-bold text-ink-900 hover:text-brand-700"
                        >
                          {m.scholarship.name}
                        </Link>
                        <StatusPill status={m.status} />
                        <UnverifiedBadge origin={m.scholarship.origin} />
                      </div>
                      <p className="text-sm text-ink-500">{m.scholarship.provider}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.scholarship.tags.map((t) => (
                          <Badge key={t} tone="ink">{t}</Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-500">
                        <span className="font-semibold text-emerald-700">{m.scholarship.amount}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-4 w-4" /> {formatDeadline(m.scholarship.deadline)}
                          {Number.isFinite(d) && (
                            <span className={cn('font-semibold', d <= 7 ? 'text-rose-600' : 'text-ink-500')}>
                              ({d} days)
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-4 w-4" /> {m.scholarship.slots} slots
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: criteria */}
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:w-72 lg:shrink-0">
                    {m.criteria.map((c) => (
                      <div key={c.label} className="flex items-center gap-2 text-sm">
                        {c.met ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                        )}
                        <span className={cn(c.met ? 'text-ink-600' : 'text-ink-400')}>{c.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Right: score + cta */}
                  <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end lg:justify-center">
                    <ScoreRing score={m.score} size={64} />
                    <Link
                      to={`/app/matches/${m.scholarship.id}`}
                      className="group inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      View & apply
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}

        {filtered.length === 0 && (
          <Card className="p-12 text-center">
            <SlidersHorizontal className="mx-auto h-10 w-10 text-ink-300" />
            <p className="mt-3 font-semibold text-ink-700">No matches with these filters</p>
            <p className="text-sm text-ink-500">Try a different filter or clear your search.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
