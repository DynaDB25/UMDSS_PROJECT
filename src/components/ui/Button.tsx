import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Buttons are the only pill-shaped surface in the system. Everything else
 * stays at 4–8px, which is what stops the UI reading as a bubbly template.
 */
export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold ' +
    'transition-[background-color,color,border-color,opacity] duration-[--dur] ease-brand ' +
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** The default call to action: solid ink. */
        primary: 'bg-ink text-canvas hover:bg-ink/85',
        /** The brand moment. Black type on gold — never white. */
        accent: 'bg-accent text-accent-on hover:bg-accent-hover',
        /** Secondary action; hairline border, no fill. */
        outline: 'border border-ink text-ink hover:bg-ink hover:text-canvas',
        /** Tertiary; sits inside dense UI. */
        subtle: 'border border-rule bg-surface text-ink hover:border-rule-strong hover:bg-surface-sunken',
        ghost: 'text-ink-secondary hover:bg-surface-sunken hover:text-ink',
        danger: 'bg-state-negative text-white hover:bg-state-negative/85',
        /** For use on ink bands, where `primary` would disappear. */
        onBand: 'bg-band-on text-band hover:bg-band-on/85',
      },
      size: {
        sm: 'h-8 px-3.5 text-[0.8125rem]',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-7 text-[0.9375rem]',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

type Variants = VariantProps<typeof buttonVariants>

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Variants & {
    loading?: boolean
    /** Rendered before the label; hidden while `loading`. */
    icon?: ReactNode
    iconRight?: ReactNode
  }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, icon, iconRight, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
})

type ButtonLinkProps = LinkProps &
  Variants & {
    icon?: ReactNode
    iconRight?: ReactNode
  }

/** Router link that carries button styling. */
export function ButtonLink({
  className,
  variant,
  size,
  block,
  icon,
  iconRight,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}

type ExternalButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  Variants & {
    icon?: ReactNode
    iconRight?: ReactNode
  }

/** Plain `<a>` with button styling, for external destinations and mailto:. */
export function ExternalButtonLink({
  className,
  variant,
  size,
  block,
  icon,
  iconRight,
  children,
  ...props
}: ExternalButtonLinkProps) {
  return (
    <a className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </a>
  )
}
