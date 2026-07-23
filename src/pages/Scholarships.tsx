import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../api/endpoints'
import type { Scholarship } from '../data/types'
import {
  Book,
  CalendarClock,
  Users,
  ArrowRight,
  SlidersHorizontal,
  Search,
} from 'lucide-react'
import { Card, Badge, UnverifiedBadge } from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { daysUntil, formatDeadline } from '../data/mock'
import { cn } from '../lib/cn'

const filters = ['All', 'Government', 'Corporate', 'International', 'Foundation'] as const

export default function Scholarships() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [query, setQuery] = useState('')
  const [scholarships, setScholarships] = useState<Scholarship[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.scholarships.list()
      .then((s) => {
        setScholarships(s)
      })
      .finally(() => setLoading(false))
  }, [])
  
  if (loading) return <div>Loading scholarships...</div>

  const filtered = scholarships.filter((s) => {
    const matchesFilter = filter === 'All' || s.providerType === filter
    const matchesQuery =
      !query ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.provider.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Book className="h-5 w-5 text-brand-600" />
          <h1 className="font-display text-2xl font-extrabold text-ink-900 dark:text-ink-50">Scholarships</h1>
        </div>
        <p className="text-ink-500 dark:text-ink-400">
          Browse and read about all available scholarships on the platform, even if they aren't a direct match for you.
        </p>
      </div>

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
                  : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800 dark:hover:bg-ink-800',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search awards…"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:focus:border-brand-500 sm:w-56"
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4">
        {filtered.map((s, i) => {
          const d = daysUntil(s.deadline)
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Card className="p-5 transition hover:shadow-md hover:shadow-ink-900/5 dark:hover:shadow-black/50">
                <div className="flex flex-col gap-5 lg:flex-row">
                  {/* Left: identity */}
                  <div className="flex flex-1 gap-4">
                    <ScholarshipLogo name={s.name} provider={s.provider} initials={s.initials} color={s.logoColor} className="h-14 w-14 rounded-2xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/app/matches/${s.id}`}
                          className="font-display text-lg font-bold text-ink-900 hover:text-brand-700 dark:text-ink-50 dark:hover:text-brand-400"
                        >
                          {s.name}
                        </Link>
                        <UnverifiedBadge origin={s.origin} />
                      </div>
                      <p className="text-sm text-ink-500 dark:text-ink-400">{s.provider}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.tags.map((t) => (
                          <Badge key={t} tone="ink">{t}</Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-500 dark:text-ink-400">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-500">{s.amount}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-4 w-4" /> {formatDeadline(s.deadline)}
                          {Number.isFinite(d) && (
                            <span className={cn('font-semibold', d <= 7 ? 'text-rose-600 dark:text-rose-500' : 'text-ink-500 dark:text-ink-400')}>
                              ({d} days)
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-4 w-4" /> {s.slots} slots
                        </span>
                      </div>
                      <p className="mt-4 text-sm text-ink-600 dark:text-ink-300">
                        {s.summary}
                      </p>
                    </div>
                  </div>

                  {/* Right: cta */}
                  <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end lg:justify-center">
                    <Link
                      to={`/app/matches/${s.id}`}
                      className="group inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      View details
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
            <SlidersHorizontal className="mx-auto h-10 w-10 text-ink-300 dark:text-ink-600" />
            <p className="mt-3 font-semibold text-ink-700 dark:text-ink-300">No scholarships found</p>
            <p className="text-sm text-ink-500 dark:text-ink-500">Try a different filter or clear your search.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
