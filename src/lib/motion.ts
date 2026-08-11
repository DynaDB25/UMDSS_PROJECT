import type { Variants, Transition } from 'framer-motion'

/**
 * One motion vocabulary for the whole product. Pages previously hand-rolled
 * their own `initial`/`animate` objects with drifting durations and delays.
 *
 * Everything here is short and eased on the same curve as the CSS tokens.
 */

export const EASE: Transition['ease'] = [0.2, 0, 0, 1]

export const DUR = {
  micro: 0.12,
  base: 0.2,
  enter: 0.4,
} as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.enter, ease: EASE } },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.enter, ease: EASE } },
}

/** Parent wrapper that walks its children in. */
export const stagger = (delayChildren = 0, staggerChildren = 0.05): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
})

/** Rows in a hairline list. Kept smaller than `fadeUp` so long lists stay calm. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
}

/** A node, dot or badge that scales in. Used by steppers and status markers. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { duration: DUR.base, ease: EASE } },
}

/** Standard props for a section that animates once when scrolled into view. */
export const inView = {
  initial: 'hidden' as const,
  whileInView: 'show' as const,
  viewport: { once: true, margin: '-80px' },
}
