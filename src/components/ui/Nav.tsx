import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type TabItem<T extends string = string> = {
  value: T
  label: ReactNode
  count?: number
}

/**
 * Underlined tabs. The active tab carries a 2px ink bar rather than a filled
 * pill, which keeps the chrome quiet next to the gold accent.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        '-mb-px flex gap-1 overflow-x-auto border-b border-rule',
        // A visible scrollbar under a tab strip reads as a rendering fault
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative whitespace-nowrap px-3.5 py-3 text-sm font-semibold transition-colors duration-[--dur]',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'tabular rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-semibold',
                    active ? 'bg-ink text-canvas' : 'bg-surface-sunken text-ink-muted',
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Two-to-four way switch inside a hairline track. Used for the For you /
 * Browse all toggle and for short filter sets.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-full border border-rule bg-surface p-1',
        size === 'sm' ? 'gap-0.5' : 'gap-1',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'whitespace-nowrap rounded-full font-semibold transition-colors duration-[--dur]',
              size === 'sm' ? 'px-3 py-1 text-[0.8125rem]' : 'px-4 py-1.5 text-sm',
              active ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && <span className="tabular opacity-60">{item.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Single toggle chip, for multi-select filter rows. */
export function FilterChip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors duration-[--dur]',
        active
          ? 'border-ink bg-ink text-canvas'
          : 'border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}
