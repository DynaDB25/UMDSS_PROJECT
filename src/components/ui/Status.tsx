import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type StateTone =
  | 'neutral'
  | 'progress'
  | 'attention'
  | 'positive'
  | 'negative'
  | 'special'

/**
 * One status vocabulary for the product. The app previously carried two
 * divergent maps (one in ui.tsx, another in Admin.tsx) that disagreed.
 */
const STATUS_TONE: Record<string, StateTone> = {
  // application statuses
  Draft: 'neutral',
  Submitted: 'progress',
  'Under Review': 'progress',
  Interview: 'special',
  Awarded: 'positive',
  Rejected: 'negative',
  // match statuses
  'Strong match': 'positive',
  'Partial match': 'attention',
  'Not eligible': 'negative',
  // document statuses
  Verified: 'positive',
  Pending: 'attention',
  'Action needed': 'negative',
}

const DOT: Record<StateTone, string> = {
  neutral: 'bg-state-neutral',
  progress: 'bg-state-progress',
  attention: 'bg-state-attention',
  positive: 'bg-state-positive',
  negative: 'bg-state-negative',
  special: 'bg-state-special',
}

const SOLID: Record<StateTone, string> = {
  neutral: 'border-transparent bg-state-neutral-soft text-state-neutral',
  progress: 'border-transparent bg-state-progress-soft text-state-progress',
  attention: 'border-transparent bg-state-attention-soft text-state-attention',
  positive: 'border-transparent bg-state-positive-soft text-state-positive',
  negative: 'border-transparent bg-state-negative-soft text-state-negative',
  special: 'border-transparent bg-state-special-soft text-state-special',
}

export function statusTone(status: string): StateTone {
  return STATUS_TONE[status] ?? 'neutral'
}

/**
 * Outline pill plus a coloured dot. Deliberately not a colour-filled chip:
 * it keeps gold unambiguous as the brand accent and reads identically in
 * both themes.
 */
export function StatusPill({
  status,
  tone,
  variant = 'outline',
  className,
}: {
  status: string
  tone?: StateTone
  variant?: 'outline' | 'solid'
  className?: string
}) {
  const t = tone ?? statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em]',
        variant === 'solid' ? SOLID[t] : 'border-rule bg-surface text-ink-secondary',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[t])} aria-hidden />
      {status}
    </span>
  )
}

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: StateTone | 'accent' | 'ink'
}) {
  const tones: Record<string, string> = {
    ...SOLID,
    accent: 'border-transparent bg-accent-soft text-state-attention',
    ink: 'border-rule bg-surface-sunken text-ink-secondary',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-[0.6875rem] font-semibold',
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
    <span
      title="This listing could not be confirmed against the provider's website. Check the provider directly before applying."
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm border border-state-attention/40 px-2 py-0.5 text-[0.6875rem] font-semibold text-state-attention',
        className,
      )}
    >
      Unverified
    </span>
  )
}
