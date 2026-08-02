import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Check, Users, X } from 'lucide-react'
import type { MatchResult, Scholarship } from '../data/types'
import { daysUntil, formatDeadline } from '../data/mock'
import { ScholarshipLogo } from './ScholarshipLogo'
import { Badge, ScoreRing, StatusPill, UnverifiedBadge } from './ui'
import { cn } from '../lib/cn'

/**
 * One hairline row in the discovery list. Rows rather than cards: it keeps the
 * page scannable and avoids the wall-of-boxes look the old design had.
 *
 * `match` is optional, the same row renders in the browse-all tab, where no
 * eligibility has been computed.
 */
export function ScholarshipRow({ scholarship, match }: { scholarship: Scholarship; match?: MatchResult }) {
  const d = daysUntil(scholarship.deadline)
  const closingSoon = Number.isFinite(d) && d <= 7 && d >= 0
  const closed = Number.isFinite(d) && d < 0
  const metCount = match?.criteria.filter((c) => c.met).length ?? 0

  return (
    <Link
      to={`/app/scholarships/${scholarship.id}`}
      className="group block px-4 py-5 transition-colors duration-[--dur] hover:bg-surface-sunken focus-visible:bg-surface-sunken sm:px-5"
    >
      <div className="flex gap-4">
        <ScholarshipLogo
          name={scholarship.name}
          provider={scholarship.provider}
          initials={scholarship.initials}
          className="h-11 w-11 sm:h-12 sm:w-12"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="t-h3 truncate text-ink transition-colors group-hover:text-accent">
                {scholarship.name}
              </h3>
              <p className="t-sm mt-0.5 truncate text-ink-muted">
                {scholarship.provider} · {scholarship.providerType}
              </p>
            </div>

            {match && <ScoreRing score={match.score} size={48} className="hidden sm:grid" />}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {match && <StatusPill status={match.status} />}
            <UnverifiedBadge origin={scholarship.origin} />
            {scholarship.tags.slice(0, 3).map((t) => (
              <Badge key={t} tone="ink">
                {t}
              </Badge>
            ))}
          </div>

          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">Award</dt>
              <dd className="tabular text-sm font-bold text-ink">{scholarship.amount}</dd>
            </div>
            <div className="t-sm flex items-center gap-1.5 text-ink-muted">
              <dt className="sr-only">Deadline</dt>
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <dd className="tabular">
                {formatDeadline(scholarship.deadline)}
                {Number.isFinite(d) && (
                  <span
                    className={cn(
                      'ml-1.5 font-semibold',
                      closed ? 'text-ink-faint' : closingSoon ? 'text-state-negative' : 'text-ink-muted',
                    )}
                  >
                    {closed ? '(closed)' : `(${d}d)`}
                  </span>
                )}
              </dd>
            </div>
            <div className="t-sm flex items-center gap-1.5 text-ink-muted">
              <dt className="sr-only">Slots</dt>
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <dd className="tabular">{scholarship.slots} slots</dd>
            </div>
          </dl>

          {match ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3">
              <p className="tabular t-xs font-semibold text-ink-secondary">
                {metCount} of {match.criteria.length} criteria met
              </p>
              <ul className="hidden flex-wrap gap-x-4 gap-y-1 md:flex">
                {match.criteria.slice(0, 3).map((c) => (
                  <li key={c.label} className="t-xs flex items-center gap-1.5">
                    {c.met ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-state-positive" aria-hidden />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-state-negative" aria-hidden />
                    )}
                    <span className={c.met ? 'text-ink-secondary' : 'text-ink-faint'}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <span className="t-xs ml-auto inline-flex items-center gap-1.5 font-semibold text-ink transition-colors group-hover:text-accent">
                View &amp; apply
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          ) : (
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-rule pt-3">
              <p className="t-sm line-clamp-2 max-w-prose text-ink-muted">{scholarship.summary}</p>
              <span className="t-xs inline-flex shrink-0 items-center gap-1.5 font-semibold text-ink transition-colors group-hover:text-accent">
                Details
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
