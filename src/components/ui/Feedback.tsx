import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

/* ------------------------------------------------------------------ *
 * Alert
 * ------------------------------------------------------------------ */

const ALERT_TONES = {
  info: { cls: 'border-rule bg-surface-sunken text-ink-secondary', accent: 'text-ink-muted', Icon: Info },
  success: { cls: 'border-state-positive/30 bg-state-positive-soft text-state-positive', accent: 'text-state-positive', Icon: CheckCircle2 },
  warning: { cls: 'border-state-attention/30 bg-state-attention-soft text-state-attention', accent: 'text-state-attention', Icon: AlertTriangle },
  danger: { cls: 'border-state-negative/30 bg-state-negative-soft text-state-negative', accent: 'text-state-negative', Icon: AlertCircle },
} as const

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONES
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { cls, accent, Icon } = ALERT_TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn('flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-start', cls, className)}
    >
      <Icon className={cn('h-4.5 w-4.5 shrink-0', accent)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className={cn('t-sm leading-relaxed', title && 'mt-1')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-rule-strong px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-rule text-ink-faint [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <p className="t-h3 text-ink">{title}</p>
      {description && <p className="t-sm mt-2 max-w-sm text-balance text-ink-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Skeleton
 * ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-sm bg-surface-sunken',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-skeleton-sweep',
        'after:bg-gradient-to-r after:from-transparent after:via-rule/60 after:to-transparent',
        className,
      )}
    />
  )
}

/** Announces loading to assistive tech while a skeleton layout is on screen. */
export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Modal — centred dialog on desktop, bottom sheet on phones
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // Move focus into the dialog once it has painted.
    const raf = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[data-autofocus], button, input, select, textarea, a[href]')
        ?.focus()
    })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(raf)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-rule bg-surface shadow-overlay',
          'rounded-t-xl sm:rounded-lg',
          widths[size],
        )}
      >
        {/* Drag affordance on phones */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-rule-strong sm:hidden" aria-hidden />

        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <div className="min-w-0">
            <h2 className="t-h3 text-ink">{title}</h2>
            {description && <p className="t-sm mt-1 text-ink-muted">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Confirmation dialog, replacing the `window.confirm` calls in the vault. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="subtle" onClick={onClose} block className="sm:w-auto">
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            block
            className="sm:w-auto"
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="t-body text-ink-secondary">{description}</p>
    </Modal>
  )
}
