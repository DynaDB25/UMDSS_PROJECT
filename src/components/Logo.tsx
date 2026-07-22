import { cn } from '../lib/cn'

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 shadow-sm shadow-brand-900/20">
        <svg viewBox="0 0 32 32" className="h-5 w-5">
          <path d="M16 5 L27 10.5 L16 16 L5 10.5 Z" fill="#fbbf24" />
          <path
            d="M8.5 13 V19 C8.5 21.7 11.8 23.8 16 23.8 C20.2 23.8 23.5 21.7 23.5 19 V13 L16 16.5 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
      {!mark && (
        <div className="leading-none">
          <span className="font-display text-lg font-extrabold tracking-tight text-ink-900 dark:text-white">
            Scholar<span className="text-brand-600">Circle</span>
          </span>
        </div>
      )}
    </div>
  )
}
