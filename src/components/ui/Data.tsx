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
    <div className={cn('min-w-0 px-4 py-4 sm:py-5 lg:px-5 lg:first:pl-0 lg:last:pr-0', className)}>
      {/* The icon is decorative, so it gives up its space on a phone rather
          than forcing the label to truncate to "ELIGIBLE MATCH...". */}
      <div className="flex items-start gap-2 sm:items-center">
        {icon && (
          <span
            className={cn(
              'hidden shrink-0 sm:inline-flex sm:[&_svg]:h-3.5 sm:[&_svg]:w-3.5',
              tone === 'band' ? 'text-band-muted' : 'text-ink-faint',
            )}
          >
            {icon}
          </span>
        )}
        <p
          className={cn(
            't-overline min-w-0 sm:truncate',
            tone === 'band' ? 'text-band-muted' : 'text-ink-muted',
          )}
        >
          {label}
        </p>
      </div>
      <p
        className={cn(
          'tabular mt-1.5 font-display text-2xl font-extrabold leading-none tracking-[-0.03em] sm:mt-2 sm:text-[2rem]',
          tone === 'accent' && 'text-accent',
          tone === 'ink' && 'text-ink',
          tone === 'band' && 'text-band-on',
        )}
      >
        {value}
      </p>
      {detail && (
        <p
          className={cn(
            't-xs mt-1.5 line-clamp-2 sm:mt-2 sm:truncate sm:text-[0.8125rem]',
            tone === 'band' ? 'text-band-muted' : 'text-ink-muted',
          )}
        >
          {detail}
        </p>
      )}
    </div>
  )
}

/**
 * Hairline-divided container for a row of `Stat`s.
 *
 * Two up on phones: stacking four of these full width turned four numbers into
 * about 400px of scrolling, which was the worst thing on the mobile dashboard.
 */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 divide-x divide-y divide-rule border-y border-rule',
        '[&>*:nth-child(-n+2)]:border-t-0 lg:grid-cols-4 lg:divide-y-0',
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
  /** What the figure means. Defaults to a match score. */
  label = 'Match score',
  /** Match scores are graded; a completion percentage is not. */
  tone,
}: {
  score: number
  size?: number
  className?: string
  label?: string
  tone?: 'graded' | 'accent'
}) {
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference
  const stroke_tone =
    tone === 'accent'
      ? 'text-accent'
      : score >= 85
        ? 'text-state-positive'
        : score >= 70
          ? 'text-state-attention'
          : 'text-state-negative'

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
          className={cn('transition-[stroke-dashoffset] duration-700 ease-brand', stroke_tone)}
          stroke="currentColor"
        />
      </svg>
      <span
        className="tabular absolute font-display font-extrabold tracking-tight text-ink"
        style={{ fontSize: size * 0.3 }}
      >
        {Math.round(score)}
      </span>
      <span className="sr-only">
        {label} {Math.round(score)} out of 100
      </span>
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
