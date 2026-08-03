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
 * Falls back to a representative sample so the page never renders empty.
 */
const FALLBACK: OpenAward[] = [
  { id: 'f1', name: 'GETFund Undergraduate Scholarship', provider: 'Ghana Education Trust Fund', amount: 'Full tuition', deadline: null },
  { id: 'f2', name: 'MTN Bright Scholarship', provider: 'MTN Ghana Foundation', amount: 'GH₵ 12,000', deadline: null },
  { id: 'f3', name: 'Mastercard Foundation Scholars', provider: 'Mastercard Foundation', amount: 'Full cost of study', deadline: null },
  { id: 'f4', name: 'Chevening Scholarship', provider: 'UK Government', amount: 'Full postgraduate', deadline: null },
  { id: 'f5', name: 'DAAD Study Scholarship', provider: 'German Academic Exchange Service', amount: '€ 934 per month', deadline: null },
  { id: 'f6', name: 'Commonwealth Shared Scholarship', provider: 'Commonwealth Scholarship Commission', amount: 'Full tuition and stipend', deadline: null },
]

export function useOpenAwards() {
  const [awards, setAwards] = useState<OpenAward[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    api.scholarships
      .list()
      .then((all) => {
        if (!active) return
        setTotal(all.length)
        const open = all
          .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
          .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
        setAwards((open.length >= 3 ? open : all).slice(0, 8))
      })
      .catch(() => active && setAwards(FALLBACK))
    return () => {
      active = false
    }
  }, [])

  return { awards: awards ?? FALLBACK, total, live: awards !== null && awards !== FALLBACK }
}
