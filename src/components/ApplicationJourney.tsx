import { motion, useReducedMotion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { DUR, EASE, popIn, stagger } from '../lib/motion'
import type { ApplicationStatus } from '../data/types'

/**
 * The application journey as a connected, animated progress tree — a "you are
 * here" for an award, from draft through to the funder's decision.
 *
 * Every application walks the same canonical path; the final node is the fork
 * that resolves to Awarded (positive) or Rejected (negative). The travelled
 * length of the track draws in on mount and the current stage pulses, so a
 * glance tells the student how far along they are. Honours
 * prefers-reduced-motion: no draw-in, no pulse, just the final state.
 */

const STAGES = ['Draft', 'Submitted', 'Under Review', 'Interview', 'Decision'] as const
type Stage = (typeof STAGES)[number]

/** Where a live status sits on the canonical path. */
const CURRENT: Record<ApplicationStatus, number> = {
  Draft: 0,
  Submitted: 1,
  'Under Review': 2,
  Interview: 3,
  Awarded: 4,
  Rejected: 4,
}

const BLURB: Record<Stage, string> = {
  Draft: 'Your pack is prepared and ready to send.',
  Submitted: 'Sent to the funder, awaiting review.',
  'Under Review': 'The funder is assessing your application.',
  Interview: 'Shortlisted for an interview.',
  Decision: "The funder's final call.",
}

type NodeState = 'done' | 'active' | 'upcoming' | 'positive' | 'negative'

export function ApplicationJourney({
  status,
  className,
}: {
  status: ApplicationStatus
  className?: string
}) {
  const reduce = useReducedMotion()
  const current = CURRENT[status]
  const awarded = status === 'Awarded'
  const rejected = status === 'Rejected'

  return (
    <motion.ol
      variants={stagger(reduce ? 0 : 0.06, 0.09)}
      initial="hidden"
      animate="show"
      className={cn('relative', className)}
    >
      {STAGES.map((stage, i) => {
        const isLast = i === STAGES.length - 1
        const done = i < current
        const active = i === current && !awarded && !rejected
        const decided = isLast && (awarded || rejected)

        const nodeState: NodeState = decided
          ? awarded
            ? 'positive'
            : 'negative'
          : done
            ? 'done'
            : active
              ? 'active'
              : 'upcoming'

        const label = isLast && decided ? (awarded ? 'Awarded' : 'Rejected') : stage
        const lit = done || active || decided

        return (
          <li key={stage} className="flex gap-4">
            {/* Track column: the node, then the connector down to the next node.
                The connector's accent fill draws in only when the step below is
                already travelled. */}
            <div className="flex flex-col items-center">
              <Node state={nodeState} reduce={!!reduce} />
              {!isLast && (
                <div className="relative my-1 w-px flex-1 overflow-hidden rounded-full bg-rule">
                  <motion.div
                    className="absolute inset-x-0 bottom-0 top-0 origin-top rounded-full bg-accent"
                    initial={{ scaleY: reduce ? (done ? 1 : 0) : 0 }}
                    animate={{ scaleY: done ? 1 : 0 }}
                    transition={{ duration: DUR.enter, ease: EASE, delay: reduce ? 0 : 0.12 + i * 0.09 }}
                  />
                </div>
              )}
            </div>

            {/* Label + one-line blurb */}
            <motion.div variants={popIn} className={cn('flex-1', isLast ? 'pb-0' : 'pb-6')}>
              <p
                className={cn(
                  'font-display text-sm font-bold tracking-tight',
                  lit ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {label}
              </p>
              <p className="t-xs mt-0.5 text-ink-muted">{BLURB[stage]}</p>
            </motion.div>
          </li>
        )
      })}
    </motion.ol>
  )
}

function Node({ state, reduce }: { state: NodeState; reduce: boolean }) {
  const base = 'relative grid h-7 w-7 shrink-0 place-items-center rounded-full'

  if (state === 'upcoming') {
    return (
      <motion.span
        variants={popIn}
        className={cn(base, 'border border-rule-strong bg-surface')}
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rule-strong" />
      </motion.span>
    )
  }

  if (state === 'active') {
    return (
      <motion.span variants={popIn} className={cn(base, 'bg-accent-soft')} aria-hidden>
        {!reduce && (
          <motion.span
            className="absolute inset-0 rounded-full ring-2 ring-accent"
            initial={{ opacity: 0.55, scale: 1 }}
            animate={{ opacity: 0, scale: 1.65 }}
            transition={{ duration: 1.7, ease: 'easeOut', repeat: Infinity }}
          />
        )}
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
      </motion.span>
    )
  }

  // done / positive / negative — a filled node with an icon.
  const fill =
    state === 'positive' ? 'bg-state-positive' : state === 'negative' ? 'bg-state-negative' : 'bg-accent'
  const text = state === 'done' ? 'text-accent-on' : 'text-white'
  const Icon = state === 'negative' ? X : Check

  return (
    <motion.span variants={popIn} className={cn(base, fill, text)} aria-hidden>
      <Icon className="h-3.5 w-3.5" strokeWidth={3} />
    </motion.span>
  )
}
