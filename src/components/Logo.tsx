import { cn } from '../lib/cn'

/**
 * Ink square, gold mark, tight wordmark. `tone="band"` inverts it for use on
 * the black sections (sidebar, auth panel, footer).
 */
export function Logo({
  className,
  mark = false,
  tone = 'ink',
  size = 'md',
}: {
  className?: string
  /** Render the mark only, without the wordmark. */
  mark?: boolean
  tone?: 'ink' | 'band'
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = {
    sm: { box: 'h-7 w-7', glyph: 'h-4 w-4', text: 'text-[0.9375rem]', dot: 'h-1 w-1' },
    md: { box: 'h-8 w-8', glyph: 'h-[1.125rem] w-[1.125rem]', text: 'text-[1.0625rem]', dot: 'h-1.5 w-1.5' },
    lg: { box: 'h-10 w-10', glyph: 'h-6 w-6', text: 'text-xl', dot: 'h-1.5 w-1.5' },
  }[size]

  return (
    <div className={cn('flex select-none items-center gap-2.5', className)}>
      <div
        className={cn(
          'grid shrink-0 place-items-center rounded-sm',
          dims.box,
          tone === 'band' ? 'bg-accent' : 'bg-ink',
        )}
      >
        <svg viewBox="0 0 32 32" className={dims.glyph} aria-hidden>
          <path
            d="M16 5 L28 10.6 L16 16.2 L4 10.6 Z"
            fill={tone === 'band' ? 'rgb(11 11 12)' : 'rgb(242 176 30)'}
          />
          <path
            d="M9 13.6 V19.4 C9 22 12.1 24 16 24 C19.9 24 23 22 23 19.4 V13.6 L16 16.9 Z"
            fill={tone === 'band' ? 'rgb(11 11 12)' : 'currentColor'}
            className={tone === 'band' ? '' : 'text-canvas'}
            opacity={tone === 'band' ? 0.55 : 1}
          />
        </svg>
      </div>
      {!mark && (
        <span
          className={cn(
            'inline-flex items-baseline gap-1 font-display font-extrabold leading-none tracking-[-0.035em]',
            dims.text,
            tone === 'band' ? 'text-band-on' : 'text-ink',
          )}
        >
          ScholarCircle
          <span className={cn('rounded-[1px] bg-accent', dims.dot)} aria-hidden />
        </span>
      )}
    </div>
  )
}
