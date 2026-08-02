import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * The big-number unit. Stats sit in a hairline-divided row rather than in
 * separate cards, it reads as a data strip instead of a dashboard template.
 */
export function Stat({
  label,
  value,
  detail,
  tone = 'ink',
  icon,
  className,
}: {
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  tone?: 'ink' | 'accent' | 'band'
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 px-5 py-5 first:pl-0 last:pr-0', className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className={cn('[&_svg]:h-3.5 [&_svg]:w-3.5', tone === 'band' ? 'text-band-muted' : 'text-ink-faint')}>
            {icon}
          </span>
        )}
        <p className={cn('t-overline truncate', tone === 'band' ? 'text-band-muted' : 'text-ink-muted')}>
          {label}
        </p>
      </div>
      <p
        className={cn(
          'tabular mt-2 font-display text-[2rem] font-extrabold leading-none tracking-[-0.03em]',
          tone === 'accent' && 'text-accent',
          tone === 'ink' && 'text-ink',
          tone === 'band' && 'text-band-on',
        )}
      >
        {value}
      </p>
      {detail && (
        <p className={cn('t-sm mt-2 truncate', tone === 'band' ? 'text-band-muted' : 'text-ink-muted')}>
          {detail}
        </p>
      )}
    </div>
  )
}

/** Hairline-divided container for a row of `Stat`s. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid divide-y divide-rule border-y border-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Progress({
  value,
  className,
  tone = 'ink',
  size = 'md',
}: {
  value: number
  className?: string
  tone?: 'ink' | 'accent' | 'positive' | 'attention'
  size?: 'sm' | 'md'
}) {
  const tones = {
    ink: 'bg-ink',
    accent: 'bg-accent',
    positive: 'bg-state-positive',
    attention: 'bg-state-attention',
  }
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-sunken',
        size === 'sm' ? 'h-1' : 'h-1.5',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-brand', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/**
 * Match score. Thin stroke, token colours, tabular centre figure.
 */
export function ScoreRing({
  score,
  size = 56,
  className,
}: {
  score: number
  size?: number
  className?: string
}) {
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference
  const tone =
    score >= 85 ? 'text-state-positive' : score >= 70 ? 'text-state-attention' : 'text-state-negative'

  return (
    <div
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-rule"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-700 ease-brand', tone)}
          stroke="currentColor"
        />
      </svg>
      <span
        className="tabular absolute font-display font-extrabold tracking-tight text-ink"
        style={{ fontSize: size * 0.3 }}
      >
        {Math.round(score)}
      </span>
      <span className="sr-only">Match score {Math.round(score)} out of 100</span>
    </div>
  )
}

/** Label/value pair used in review steps and detail sidebars. */
export function DataRow({
  label,
  value,
  className,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', className)}>
      <dt className="t-sm shrink-0 text-ink-muted">{label}</dt>
      <dd className="t-sm min-w-0 text-right font-semibold text-ink">{value}</dd>
    </div>
  )
}
