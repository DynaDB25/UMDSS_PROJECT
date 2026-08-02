/**
 * Display formatting for the figures that appear all over the product.
 *
 * These exist because the dashboard was rendering things like "GH₵ 10763k"
 * and "0d", which read as bugs rather than data.
 */

/** Cedis at a human scale: 10763000 becomes "GH₵ 10.8M", not "GH₵ 10763k". */
export function formatCedis(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'GH₵ 0'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `GH₵ ${m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return `GH₵ ${k >= 10 ? Math.round(k) : k.toFixed(1)}k`
  }
  return `GH₵ ${Math.round(value).toLocaleString('en-GB')}`
}

/**
 * A deadline in words. "0d" is the difference between an award you can still
 * enter and one you have lost, so it never gets rendered as a bare number.
 */
export function formatDaysLeft(days: number): string {
  if (!Number.isFinite(days)) return 'No deadline'
  if (days < 0) return 'Closed'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 30) return `${days} days`
  if (days <= 60) return 'Next month'
  return `${Math.round(days / 30)} months`
}

/** The compact form for a countdown tile: "Today", "1 day", "12 days". */
export function formatDaysShort(days: number): { value: string; unit: string } {
  if (!Number.isFinite(days)) return { value: '--', unit: 'rolling' }
  if (days < 0) return { value: '--', unit: 'closed' }
  if (days === 0) return { value: 'Today', unit: '' }
  return { value: String(days), unit: days === 1 ? 'day' : 'days' }
}

/** True when a deadline is close enough to deserve the accent colour. */
export function isUrgent(days: number): boolean {
  return Number.isFinite(days) && days >= 0 && days <= 7
}
