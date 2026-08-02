import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Compass, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { api } from '../api/endpoints'
import type { MatchResult, Scholarship } from '../data/types'
import { daysUntil } from '../data/mock'
import { ScholarshipRow } from '../components/ScholarshipRow'
import { PageListSkeleton } from '../components/skeletons'
import {
  ButtonLink,
  EmptyState,
  FilterChip,
  Input,
  SegmentedControl,
  Stat,
  StatRow,
} from '../components/ui'
import { listItem, stagger } from '../lib/motion'

type Tab = 'foryou' | 'all'

const PROVIDER_FILTERS = ['All', 'Government', 'Corporate', 'International', 'Foundation'] as const
type ProviderFilter = (typeof PROVIDER_FILTERS)[number]

const cedis = (n: number) => `GH₵ ${n.toLocaleString('en-GB')}`

/**
 * Discovery. Browsing the catalogue and reading your ranked matches used to be
 * two near-identical screens; they are one here, switched by a segmented
 * control, so there is a single place to look for an award.
 */
export default function Scholarships() {
  const [tab, setTab] = useState<Tab>('foryou')
  const [provider, setProvider] = useState<ProviderFilter>('All')
  const [strongOnly, setStrongOnly] = useState(false)
  const [query, setQuery] = useState('')

  const [scholarships, setScholarships] = useState<Scholarship[]>([])
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.scholarships.list().catch(() => []), api.matches.list().catch(() => [])])
      .then(([s, m]) => {
        setScholarships(s)
        setMatches(m)
      })
      .finally(() => setLoading(false))
  }, [])

  const eligible = useMemo(() => matches.filter((m) => m.status !== 'Not eligible'), [matches])
  const potentialFunding = useMemo(
    () => eligible.reduce((sum, m) => sum + (m.scholarship.amountValue || 0), 0),
    [eligible],
  )
  const closingSoon = useMemo(
    () =>
      eligible.filter((m) => {
        const d = daysUntil(m.scholarship.deadline)
        return Number.isFinite(d) && d >= 0 && d <= 14
      }).length,
    [eligible],
  )

  const visibleMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return matches
      .filter((m) => (strongOnly ? m.status === 'Strong match' : m.status !== 'Not eligible'))
      .filter((m) => provider === 'All' || m.scholarship.providerType === provider)
      .filter(
        (m) =>
          !q ||
          m.scholarship.name.toLowerCase().includes(q) ||
          m.scholarship.provider.toLowerCase().includes(q),
      )
      .sort((a, b) => b.score - a.score)
  }, [matches, strongOnly, provider, query])

  const visibleAll = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scholarships
      .filter((s) => provider === 'All' || s.providerType === provider)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q))
  }, [scholarships, provider, query])

  if (loading) return <PageListSkeleton label="Loading scholarships" />

  const rows = tab === 'foryou' ? visibleMatches : visibleAll
  const filtersActive = provider !== 'All' || query !== '' || strongOnly

  const clearFilters = () => {
    setProvider('All')
    setQuery('')
    setStrongOnly(false)
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-6">
        <p className="t-overline text-accent">Discovery</p>
        <h1 className="t-h1 mt-2 text-ink">Scholarships</h1>
        <p className="t-body mt-2 max-w-prose text-ink-muted">
          Ranked against your WASSCE aggregate, programme, region and financial need, and every
          result shows exactly why you do or do not qualify.
        </p>
      </header>

      <StatRow>
        <Stat label="Scholarships scanned" value={scholarships.length} icon={<Compass />} />
        <Stat
          label="You qualify for"
          value={eligible.length}
          tone="accent"
          detail={`${matches.filter((m) => m.status === 'Strong match').length} strong`}
          icon={<Sparkles />}
        />
        <Stat label="Potential funding" value={cedis(potentialFunding)} />
        <Stat
          label="Closing in 14 days"
          value={closingSoon}
          detail={closingSoon ? 'Act on these first' : 'Nothing urgent'}
        />
      </StatRow>

      {/* Controls */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'foryou', label: 'For you', count: eligible.length },
              { value: 'all', label: 'Browse all', count: scholarships.length },
            ]}
            className="self-start"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search awards or funders…"
            aria-label="Search scholarships"
            inputSize="sm"
            icon={<Search />}
            className="sm:w-72"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PROVIDER_FILTERS.map((f) => (
            <FilterChip key={f} active={provider === f} onClick={() => setProvider(f)}>
              {f}
            </FilterChip>
          ))}
          {tab === 'foryou' && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-rule sm:block" aria-hidden />
              <FilterChip active={strongOnly} onClick={() => setStrongOnly((s) => !s)}>
                Strong matches only
              </FilterChip>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {rows.length > 0 ? (
        <div>
          <p className="t-sm mb-3 text-ink-muted">
            Showing <span className="tabular font-semibold text-ink">{rows.length}</span>{' '}
            {tab === 'foryou' ? 'match' : 'scholarship'}
            {rows.length === 1 ? '' : 'es'}
          </p>
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger(0, 0.04)}
            className="rule-list overflow-hidden rounded-md border border-rule bg-surface"
          >
            {tab === 'foryou'
              ? visibleMatches.map((m) => (
                  <motion.div key={m.scholarship.id} variants={listItem}>
                    <ScholarshipRow scholarship={m.scholarship} match={m} />
                  </motion.div>
                ))
              : visibleAll.map((s) => (
                  <motion.div key={s.id} variants={listItem}>
                    <ScholarshipRow scholarship={s} />
                  </motion.div>
                ))}
          </motion.div>
        </div>
      ) : filtersActive ? (
        <EmptyState
          icon={<SlidersHorizontal />}
          title="Nothing matches these filters"
          description="Try a different provider type, or clear the filters to see everything again."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
            >
              Clear all filters
            </button>
          }
        />
      ) : tab === 'foryou' ? (
        <EmptyState
          icon={<Sparkles />}
          title="No matches yet"
          description="The matching engine needs your WASSCE aggregate, programme and home region before it can rank awards for you."
          action={
            <ButtonLink to="/app/settings" variant="accent">
              Complete my profile
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={<Compass />}
          title="No scholarships listed yet"
          description="The daily scrape has not returned any awards. Check back shortly."
        />
      )}
    </div>
  )
}
