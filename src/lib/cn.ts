import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes so a caller's `className` can always override the
 * component's own defaults. The previous implementation just joined strings,
 * which meant conflicting utilities both survived and CSS order decided the
 * winner, the variant system depends on this resolving properly.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
