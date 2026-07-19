import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/70 bg-white shadow-sm shadow-ink-900/5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Avatar({
  initials,
  className,
  color = 'bg-gradient-to-br from-brand-500 to-brand-700',
}: {
  initials: string
  className?: string
  color?: string
}) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-full font-semibold text-white',
        color,
        className,
      )}
    >
      {initials}
    </div>
  )
}

const statusStyles: Record<string, string> = {
  // application statuses
  Draft: 'bg-ink-100 text-ink-600 ring-ink-200',
  Submitted: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Under Review': 'bg-amber-50 text-amber-700 ring-amber-200',
  Interview: 'bg-violet-50 text-violet-700 ring-violet-200',
  Awarded: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  // match statuses
  'Strong match': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Partial match': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Not eligible': 'bg-rose-50 text-rose-700 ring-rose-200',
  // doc statuses
  Verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Action needed': 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        statusStyles[status] ?? 'bg-ink-100 text-ink-600 ring-ink-200',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  )
}

export function Badge({
  children,
  className,
  tone = 'brand',
}: {
  children: ReactNode
  className?: string
  tone?: 'brand' | 'gold' | 'ink' | 'green'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    gold: 'bg-amber-50 text-amber-700 ring-amber-200',
    ink: 'bg-ink-100 text-ink-600 ring-ink-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Flags rows whose live scrape failed and fell back to hardcoded data, so their
 * amount and deadline are not confirmed against the provider's site.
 */
export function UnverifiedBadge({ origin, className }: { origin?: string; className?: string }) {
  if (origin !== 'curated') return null
  return (
    <Badge
      tone="gold"
      className={className}
      title="This listing could not be confirmed against the provider's website. Check the provider directly before applying."
    >
      Unverified
    </Badge>
  )
}

export function Progress({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'gold' | 'green' }) {
  const tones = {
    brand: 'bg-brand-600',
    gold: 'bg-amber-500',
    green: 'bg-emerald-500',
  }
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 85 ? '#059669' : score >= 70 ? '#d97706' : '#e11d48'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold text-ink-800">{score}</span>
    </div>
  )
}
