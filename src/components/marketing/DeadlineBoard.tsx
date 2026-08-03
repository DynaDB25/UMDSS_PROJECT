import { ArrowRight } from 'lucide-react'
import { daysUntil, formatDeadline } from '../../data/mock'
import { cn } from '../../lib/cn'
import { ButtonLink } from '../ui'
import { useOpenAwards, type OpenAward } from './useOpenAwards'

const FUNDERS =
  'GETFund · MTN Ghana Foundation · Mastercard Foundation · Chevening · DAAD · Commonwealth · ' +
  'Stanbic Bank · UNESCO · British Council · World Bank · Scholarship Secretariat'

/** Days-remaining chip. Gold only when it is genuinely urgent. */
function DaysLeft({ deadline }: { deadline: string | null }) {
  const d = daysUntil(deadline)
  if (!Number.isFinite(d)) {
    return <span className="tabular t-sm text-band-muted">Rolling</span>
  }
  const urgent = d <= 14
  return (
    <span
      className={cn(
        'tabular font-display text-sm font-extrabold',
        urgent ? 'text-accent' : 'text-band-on',
      )}
    >
      {d} {d === 1 ? 'day' : 'days'}
    </span>
  )
}

export function DeadlineBoard() {
  const { awards, total, live } = useOpenAwards()

  return (
    <section className="border-y border-band-rule bg-band">
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-band-rule pb-6">
          <div className="min-w-0">
            <p className="t-overline text-accent">Open right now</p>
            <h2 className="t-display-md mt-3 text-balance text-band-on">
              Awards on the board today.
            </h2>
          </div>
          <p className="t-sm max-w-sm text-band-muted">
            {live
              ? `Read live from the catalogue${total ? `, ${total} awards` : ''}, refreshed daily by an automated scraper. Sign in to see which of these you actually qualify for.`
              : 'A sample of the funders covered across Ghana and abroad.'}
          </p>
        </div>

        {/* Column headings, hidden on phones where the rows restack */}
        <div className="hidden grid-cols-[minmax(0,1fr)_14rem_9rem_7rem] gap-6 border-b border-band-rule py-3 lg:grid">
          {['Award', 'Funder', 'Closes', 'Remaining'].map((h, i) => (
            <span key={h} className={cn('t-overline text-band-muted', i === 3 && 'text-right')}>
              {h}
            </span>
          ))}
        </div>

        <ul>
          {awards.slice(0, 6).map((s: OpenAward) => (
            <li
              key={s.id}
              className="grid gap-x-6 gap-y-1.5 border-b border-band-rule py-5 lg:grid-cols-[minmax(0,1fr)_14rem_9rem_7rem] lg:items-baseline"
            >
              <span className="font-display text-lg font-bold tracking-tight text-band-on">
                {s.name}
              </span>
              <span className="t-sm text-band-muted lg:truncate">{s.provider}</span>
              <span className="tabular t-sm text-band-muted">
                {s.deadline ? formatDeadline(s.deadline) : 'Rolling'}
              </span>
              <span className="lg:text-right">
                <DaysLeft deadline={s.deadline} />
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
          <p className="t-xs max-w-2xl leading-relaxed text-band-muted">{FUNDERS}</p>
          <ButtonLink
            to="/register"
            variant="onBand"
            size="sm"
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            See what you qualify for
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
