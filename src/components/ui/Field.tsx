import { forwardRef, useId } from 'react'
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Form controls share one focus treatment: the border goes ink and a hard
 * 2px outline appears. No blurred rings anywhere in this system.
 */
const controlBase =
  'w-full rounded-md border bg-surface text-ink placeholder:text-ink-faint ' +
  'transition-[border-color,background-color] duration-[--dur] ease-brand ' +
  'focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-1px] ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted'

const controlSize = {
  sm: 'h-9 px-3 text-[0.8125rem]',
  md: 'h-11 px-3.5 text-sm',
  lg: 'h-12 px-4 text-sm',
}

type Size = keyof typeof controlSize

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-[0.8125rem] font-semibold text-ink-secondary"
        >
          {label}
          {required && <span className="text-state-negative">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-state-negative">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs leading-relaxed text-ink-muted">{hint}</p>
      )}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: Size
  invalid?: boolean
  icon?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputSize = 'md', invalid, icon, trailing, ...props },
  ref,
) {
  const control = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        controlSize[inputSize],
        invalid ? 'border-state-negative' : 'border-rule hover:border-rule-strong',
        icon && 'pl-10',
        trailing && 'pr-11',
        className,
      )}
      {...props}
    />
  )

  if (!icon && !trailing) return control

  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      )}
      {control}
      {trailing && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted">{trailing}</span>
      )}
    </div>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        'px-3.5 py-3 text-sm leading-relaxed',
        invalid ? 'border-state-negative' : 'border-rule hover:border-rule-strong',
        className,
      )}
      {...props}
    />
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  inputSize?: Size
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, inputSize = 'md', invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          controlBase,
          controlSize[inputSize],
          'cursor-pointer appearance-none pr-10',
          invalid ? 'border-state-negative' : 'border-rule hover:border-rule-strong',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
    </div>
  )
})

export function Checkbox({
  label,
  hint,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode }) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-rule-strong bg-surface
          checked:border-ink checked:bg-ink
          checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.5l3.2 3.2L13 5%22/></svg>')]
          bg-[length:12px] bg-center bg-no-repeat
          transition-colors duration-[--dur] disabled:opacity-45"
        {...props}
      />
      {(label || hint) && (
        <label htmlFor={inputId} className="cursor-pointer select-none">
          {label && <span className="block text-sm text-ink">{label}</span>}
          {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
        </label>
      )}
    </div>
  )
}

export function Radio({
  label,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <input
        id={inputId}
        type="radio"
        className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-rule-strong bg-surface
          checked:border-[5px] checked:border-ink transition-[border] duration-[--dur] disabled:opacity-45"
        {...props}
      />
      {label && (
        <label htmlFor={inputId} className="cursor-pointer select-none text-sm text-ink">
          {label}
        </label>
      )}
    </div>
  )
}
