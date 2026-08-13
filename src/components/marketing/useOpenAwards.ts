import { useEffect, useState } from 'react'
import { api } from '../../api/endpoints'
import { daysUntil } from '../../data/mock'

export type OpenAward = {
  id: string
  name: string
  provider: string
  amount: string
  deadline: string | null
}

/**
 * Awards that are genuinely open, soonest first, read from the public
 * catalogue. The landing page shows real records rather than an invented
 * screenshot, which is the whole argument for the product.
 *
 * There is deliberately no sample to fall back on. This hook used to ship six
 * hand-written awards with invented amounts and render them under "Open right
 * now" whenever the API was slow or down, which is the exact claim the product
 * exists to disprove. `awards` is null until real rows arrive, and stays null
 * if they never do; callers show nothing rather than something untrue.
 */
export type OpenAwardsStatus = 'loading' | 'ready' | 'failed'

export function useOpenAwards() {
  const [awards, setAwards] = useState<OpenAward[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  // Read off the catalogue rather than written down. The hand-written strip
  // this replaces named eleven funders, of which the catalogue contained
  // exactly none: their scrapers are inactive and their curated rows were
  // purged, so the page was advertising coverage that did not exist.
  const [providers, setProviders] = useState<string[]>([])
  // Kept apart from `awards` so a failure cannot be reported as "still
  // loading", which is its own small untruth on a page about not inventing
  // things. Loading and failed differ to the reader even though both show
  // no awards.
  const [status, setStatus] = useState<OpenAwardsStatus>('loading')

  useEffect(() => {
    let active = true
    api.scholarships
      .list()
      .then((all) => {
        if (!active) return
        setTotal(all.length)
        setStatus('ready')

        const counts = new Map<string, number>()
        for (const s of all) {
          const name = (s.provider ?? '').trim()
          if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        setProviders(
          [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name),
        )
        // Only awards still genuinely open belong under a heading that says
        // so. Topping the list up with closed or undated rows to reach a
        // fuller looking board would misrepresent every one it added.
        const open = all
          .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
          .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
        setAwards(open.slice(0, 8))
      })
      .catch(() => {
        if (!active) return
        setAwards(null)
        setStatus('failed')
      })
    return () => {
      active = false
    }
  }, [])

  return { awards, total, providers, status, live: status === 'ready' }
}
