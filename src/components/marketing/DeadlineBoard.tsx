import { useEffect, useState } from 'react'
import { api } from '../../api/endpoints'
import type { Scholarship } from '../../data/types'
import { daysUntil, formatDeadline } from '../../data/mock'
import { cn } from '../../lib/cn'

/**
 * A live notice board of awards that are actually open, read straight from the
 * public catalogue. Marketing pages normally show invented screenshots; this
 * shows the real thing, which is the whole argument for the product.
 *
 * Falls back to a representative sample if the API is unreachable so the page
 * never renders empty.
 */

const FALLBACK: Pick<Scholarship, 'id' | 'name' | 'provider' | 'amount' | 'deadline'>[] = [
  { id: 'f1', name: 'GETFund Undergraduate Scholarship', provider: 'Ghana Education Trust Fund', amount: 'Full tuition', deadline: null },
  { id: 'f2', name: 'MTN Bright Scholarship', provider: 'MTN Ghana Foundation', amount: 'GH₵ 12,000', deadline: null },
  { id: 'f3', name: 'Mastercard Foundation Scholars', provider: 'Mastercard Foundation', amount: 'Full cost', deadline: null },
  { id: 'f4', name: 'Chevening Scholarship', provider: 'UK Government', amount: 'Full postgraduate', deadline: null },
  { id: 'f5', name: 'DAAD Study Scholarship', provider: 'German Academic Exchange', amount: '€ 934 / month', deadline: null },
]

type Row = { id: string; name: string; provider: string; amount: string; deadline: string | null }

export function DeadlineBoard() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let active = true
    api.scholarships
      .list()
      .then((all) => {
        if (!active) return
        // Open awards first, soonest deadline at the top.
        const open = all
          .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
          .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
        const pool = open.length >= 3 ? open : all
        setRows(pool.slice(0, 6))
      })
      .catch(() => active && setRows(FALLBACK))
    return () => {
      active = false
    }
  }, [])

  const data = rows ?? FALLBACK
  const live = rows !== null && rows !== FALLBACK

  return (
    <section className="border-y border-band-rule bg-band">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-band-rule pb-5">
          <div>
            <p className="t-overline text-accent">Open right now</p>
            <h2 className="t-display-md mt-3 text-balance text-band-on">
              Awards on the board today.
            </h2>
          </div>
          <p className="t-sm max-w-xs text-band-muted">
            {live
              ? 'Pulled live from the catalogue our scraper refreshes every day.'
              : 'A sample of the funders covered across Ghana and abroad.'}
          </p>
        </div>

        {/* Board header, hidden on phones where the rows restack */}
        <div className="hidden grid-cols-[1fr_9rem_7rem_5rem] gap-4 border-b border-band-rule py-3 md:grid">
          {['Award', 'Funder', 'Closes', 'Days'].map((h, i) => (
            <span
              key={h}
              className={cn('t-overline text-band-muted', i === 3 && 'text-right')}
            >
              {h}
            </span>
          ))}
        </div>

        <ul>
          {data.map((s) => {
            const d = daysUntil(s.deadline)
            const known = Number.isFinite(d)
            const urgent = known && d <= 14
            return (
              <li
                key={s.id}
                className="grid gap-x-4 gap-y-1 border-b border-band-rule py-4 md:grid-cols-[1fr_9rem_7rem_5rem] md:items-baseline"
              >
                <span className="font-display text-base font-bold tracking-tight text-band-on sm:text-lg">
                  {s.name}
                </span>
                <span className="t-sm text-band-muted md:truncate">{s.provider}</span>
                <span className="tabular t-sm text-band-muted">
                  {s.deadline ? formatDeadline(s.deadline) : 'Rolling'}
                </span>
                <span
                  className={cn(
                    'tabular font-display text-sm font-extrabold md:text-right',
                    urgent ? 'text-accent' : 'text-band-muted',
                  )}
                >
                  {known ? `${d}d` : '--'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
