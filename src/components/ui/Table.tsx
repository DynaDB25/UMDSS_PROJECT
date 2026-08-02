import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Hairline table. The wrapper owns the horizontal scroll so a wide table never
 * pushes the page body sideways on a phone.
 */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto overscroll-x-contain', className)}>
      <table className="w-full min-w-[720px] border-collapse text-left">{children}</table>
    </div>
  )
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      scope="col"
      className={cn(
        't-overline whitespace-nowrap border-b border-rule px-4 py-3 text-ink-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <td
      className={cn(
        'border-b border-rule px-4 py-3.5 text-sm text-ink-secondary',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors duration-[--dur] last:[&>td]:border-b-0',
        onClick && 'cursor-pointer',
        'hover:bg-surface-sunken',
        className,
      )}
    >
      {children}
    </tr>
  )
}
