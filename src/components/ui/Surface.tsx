import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * A card is a hairline and a background step — never a shadow. Elevation only
 * exists for things that genuinely float (modals, menus).
 */
export function Card({
  className,
  children,
  as: As = 'div',
}: {
  className?: string
  children: ReactNode
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <As className={cn('rounded-md border border-rule bg-surface', className)}>{children}</As>
  )
}

/** Initials tile. Square with a small radius — round avatars read generic. */
export function Avatar({
  initials,
  className,
  tone = 'ink',
}: {
  initials: string
  className?: string
  tone?: 'ink' | 'accent' | 'band'
}) {
  const tones = {
    ink: 'bg-ink text-canvas',
    accent: 'bg-accent text-accent-on',
    band: 'border border-band-rule bg-band-rule text-band-on',
  }
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-sm font-display text-[0.8125rem] font-bold uppercase tracking-tight',
        tones[tone],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="t-h3 text-ink">{title}</h2>
        {description && <p className="t-sm mt-1 text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Page-level heading block used at the top of every app screen. */
export function PageHeader({
  overline,
  title,
  description,
  action,
  className,
}: {
  overline?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5',
        className,
      )}
    >
      <div className="min-w-0">
        {overline && <p className="t-overline mb-2 text-accent">{overline}</p>}
        <h1 className="t-h1 text-ink">{title}</h1>
        {description && <p className="t-body mt-2 max-w-prose text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}

/** Small caps label used to open a sub-section inside a page. */
export function SectionLabel({
  children,
  className,
  action,
}: {
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="t-overline text-ink-muted">{children}</h2>
      {action}
    </div>
  )
}
