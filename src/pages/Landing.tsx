import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Logo } from '../components/Logo'
import { DeadlineBoard } from '../components/marketing/DeadlineBoard'
import { useOpenAwards } from '../components/marketing/useOpenAwards'
import { ButtonLink } from '../components/ui'
import { daysUntil, formatDeadline } from '../data/mock'
import { cn } from '../lib/cn'
import { fadeUp, inView, listItem, stagger } from '../lib/motion'

const modules = [
  {
    title: 'Matching engine',
    lead: 'Only what you qualify for.',
    desc: 'Your WASSCE aggregate, programme and home region are checked against each funder’s published criteria. Every result shows the rule it passed or failed, so eligibility is never a black box.',
  },
  {
    title: 'Document vault',
    lead: 'Upload once, reuse everywhere.',
    desc: 'Ghana Card, transcripts, admission letter. Encrypted with AES-256 at rest and attached automatically to any application that asks for them, instead of five separate portals.',
  },
  {
    title: 'SMS notifications',
    lead: 'Built for the districts.',
    desc: 'Deadline, status and interview alerts through the Hubtel gateway, tied to the Ghanaian academic calendar. Email open rates are a fraction of SMS, and a missed alert costs a year.',
  },
  {
    title: 'Decision bot',
    lead: 'An adviser that knows your file.',
    desc: 'Grounded in your own profile, matches and applications. It compares awards, drafts your personal statement in your voice, and runs a scored mock interview one question at a time.',
  },
]

const steps = [
  { n: '01', title: 'Build your profile', desc: 'WASSCE aggregate, programme and home region, entered once.' },
  { n: '02', title: 'Get ranked matches', desc: 'A ranked list of awards you qualify for, with the reasoning shown.' },
  { n: '03', title: 'Apply from one vault', desc: 'Stored documents attach to any application in seconds.' },
  { n: '04', title: 'Never miss a close', desc: 'SMS before every deadline, status change and interview.' },
]

const coverage = [
  ['16', 'regions'],
  ['261', 'district schemes'],
  ['98%', 'SMS open rate'],
] as const

/* ------------------------------------------------------------------ */

function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 bg-canvas transition-colors duration-[--dur] ${
        scrolled ? 'border-b border-rule' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-8">
        <Link to="/" aria-label="ScholarCircle home" className="shrink-0">
          <Logo size="sm" className="sm:hidden" />
          <Logo className="hidden sm:flex" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            ['Open awards', '#board'],
            ['What it does', '#modules'],
            ['How it works', '#how'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ButtonLink to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </ButtonLink>
          <ButtonLink to="/register" variant="accent" size="sm">
            Get started
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}

/**
 * The three awards closing soonest, read live from the public catalogue. This
 * sits where a marketing page normally puts a mocked-up screenshot, on the
 * argument that a real record is more persuasive than a drawing of one.
 */
function ClosingSoon() {
  const { awards, live } = useOpenAwards()

  return (
    <div className="rounded-md border border-rule bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <p className="t-overline text-ink-muted">Closing soonest</p>
        {live && (
          <span className="t-overline flex items-center gap-1.5 text-ink-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-state-positive" aria-hidden />
            Live
          </span>
        )}
      </div>

      <ul className="rule-list">
        {awards.slice(0, 3).map((s) => {
          const d = daysUntil(s.deadline)
          const known = Number.isFinite(d)
          return (
            <li key={s.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-[0.9375rem] font-bold leading-snug tracking-tight text-ink">
                    {s.name}
                  </p>
                  <p className="t-xs mt-1 truncate text-ink-muted">{s.provider}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'tabular font-display text-lg font-extrabold leading-none tracking-tight',
                      known && d <= 14 ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {known ? d : '--'}
                  </p>
                  <p className="t-xs mt-1 text-ink-muted">{known ? 'days' : 'rolling'}</p>
                </div>
              </div>
              <p className="tabular t-xs mt-2 text-ink-faint">
                Closes {s.deadline ? formatDeadline(s.deadline) : 'when filled'}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="t-xs border-t border-rule px-4 py-3 text-ink-muted">
        Create a profile to see which of these you qualify for, and why.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

     

      {/* ---------------- Hero ----------------
          A thesis, not a slogan. Sentence case at a considered scale, with the
          supporting column carrying the action and the coverage figures. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger(0, 0.08)}
            className="grid gap-y-10 py-12 sm:py-16 lg:grid-cols-12 lg:gap-x-16 lg:py-24"
          >
            <div className="lg:col-span-7">
              <motion.h1
                variants={fadeUp}
                className="font-display font-extrabold tracking-[-0.035em] text-ink"
                style={{ fontSize: 'clamp(2.125rem, 4.6vw, 4rem)', lineHeight: 1.04 }}
              >
                Ghana does not have a shortage of scholarship money.
                <span className="mt-3 block text-accent sm:mt-4">
                  It has a shortage of access.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="t-body-lg mt-8 max-w-prose text-ink-secondary"
              >
                ScholarCircle matches you to awards you actually qualify for, keeps your Ghana Card,
                transcripts and admission letter in one encrypted vault, and sends an SMS before
                every deadline closes. Every match shows the rule it passed, so eligibility is never
                a guess.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <ButtonLink
                  to="/register"
                  variant="accent"
                  size="lg"
                  className="justify-center"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Find my scholarships
                </ButtonLink>
                <ButtonLink to="/login" variant="outline" size="lg" className="justify-center">
                  Sign in
                </ButtonLink>
                <p className="t-sm text-ink-muted sm:ml-2">Free for students.</p>
              </motion.div>
            </div>

            {/* Real records, not an invented product screenshot */}
            <motion.aside
              variants={fadeUp}
              className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-16"
            >
              <ClosingSoon />
            </motion.aside>
          </motion.div>
        </div>
      </section>

      {/* Coverage, as a thin reference strip rather than a section of its own */}
      <div className="border-b border-rule bg-surface-sunken">
        <dl className="mx-auto grid max-w-[1400px] grid-cols-2 divide-rule px-4 sm:grid-cols-4 sm:divide-x sm:px-8">
          {[...coverage, ['Daily', 'catalogue refresh'] as const].map(([value, label]) => (
            <div key={label} className="py-5 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <dd className="tabular font-display text-2xl font-extrabold tracking-[-0.03em] text-ink">
                {value}
              </dd>
              <dt className="t-xs mt-1 text-ink-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* ---------------- Live board ---------------- */}
      <div id="board" className="scroll-mt-16">
        <DeadlineBoard />
      </div>

      {/* ---------------- Modules ---------------- */}
      <section id="modules" className="scroll-mt-16 border-b border-rule">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <motion.div {...inView} variants={stagger(0, 0.07)} className="max-w-2xl">
            <motion.p variants={fadeUp} className="t-overline text-ink-muted">
              Four integrated modules
            </motion.p>
            <motion.h2 variants={fadeUp} className="t-display-md mt-4 text-balance text-ink">
              One platform, discovery through interview.
            </motion.h2>
          </motion.div>

          <motion.ol {...inView} variants={stagger(0.1, 0.07)} className="mt-14 border-t border-rule">
            {modules.map((m, i) => (
              <motion.li
                key={m.title}
                variants={listItem}
                className="group grid gap-x-10 gap-y-3 border-b border-rule py-8 sm:py-10 lg:grid-cols-12 lg:items-baseline"
              >
                <div className="flex items-baseline gap-5 lg:col-span-4">
                  <span className="tabular font-display text-3xl font-black leading-none tracking-[-0.04em] text-rule-strong transition-colors duration-[--dur] group-hover:text-accent">
                    0{i + 1}
                  </span>
                  <h3 className="t-h2 text-ink">{m.title}</h3>
                </div>
                <p className="font-display text-lg font-bold tracking-tight text-ink lg:col-span-3">
                  {m.lead}
                </p>
                <p className="t-body max-w-prose text-ink-muted lg:col-span-5">{m.desc}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---------------- Process ---------------- */}
      <section id="how" className="scroll-mt-16 border-b border-rule bg-surface-sunken">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <motion.div {...inView} variants={stagger(0, 0.07)} className="max-w-2xl">
            <motion.p variants={fadeUp} className="t-overline text-ink-muted">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} className="t-display-md mt-4 text-balance text-ink">
              From profile to funding in four steps.
            </motion.h2>
          </motion.div>

          <motion.ol
            {...inView}
            variants={stagger(0.1, 0.07)}
            className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4"
          >
            {steps.map((s) => (
              <motion.li key={s.n} variants={listItem} className="border-t-2 border-ink pt-5">
                <span className="tabular t-overline text-accent">{s.n}</span>
                <h3 className="t-h3 mt-3 text-ink">{s.title}</h3>
                <p className="t-sm mt-2 text-ink-muted">{s.desc}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---------------- Pull quote ---------------- */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <motion.figure {...inView} variants={stagger(0, 0.08)}>
            <motion.blockquote
              variants={fadeUp}
              className="max-w-5xl font-display font-extrabold tracking-[-0.035em] text-ink"
              style={{ fontSize: 'clamp(1.5rem, 3.4vw, 2.75rem)', lineHeight: 1.12 }}
            >
              <span className="text-accent">&ldquo;</span>I qualified for three scholarships. I
              missed the interview notification by four days and lost a year of funding.
              <span className="text-accent">&rdquo;</span>
            </motion.blockquote>
            <motion.figcaption
              variants={fadeUp}
              className="mt-8 grid gap-6 border-t border-rule pt-6 lg:grid-cols-12"
            >
              <p className="t-overline text-ink-muted lg:col-span-4">The reason this exists</p>
              <p className="t-body max-w-prose text-ink-secondary lg:col-span-8">
                Being capable on paper should be enough to be reachable in practice. Information
                sits scattered across disconnected portals, deadlines pass unannounced, and the same
                documents get reformatted again and again. ScholarCircle is the layer that closes
                that gap.
              </p>
            </motion.figcaption>
          </motion.figure>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="bg-accent">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-4 py-16 sm:px-8 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="t-overline text-accent-on/70">Free for students</p>
            <h2
              className="mt-4 max-w-2xl text-balance font-display font-extrabold tracking-[-0.035em] text-accent-on"
              style={{ fontSize: 'clamp(1.625rem, 3.4vw, 2.75rem)', lineHeight: 1.08 }}
            >
              Find out what you qualify for in under five minutes.
            </h2>
          </div>
          <ButtonLink
            to="/register"
            variant="primary"
            size="lg"
            className="w-full shrink-0 justify-center sm:w-auto"
            iconRight={<ArrowUpRight className="h-4 w-4" />}
          >
            Create your free profile
          </ButtonLink>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="bg-band">
        <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Logo tone="band" />
              <p className="t-sm mt-4 max-w-sm text-band-muted">
                A unified scholarship management and decision support system for Ghanaian tertiary
                students.
              </p>
            </div>

            <nav aria-label="Product">
              <p className="t-overline text-band-on">Product</p>
              <ul className="mt-4 space-y-2.5">
                {[
                  ['Open awards', '#board'],
                  ['What it does', '#modules'],
                  ['How it works', '#how'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="t-sm text-band-muted transition-colors hover:text-band-on">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Account">
              <p className="t-overline text-band-on">Account</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link to="/login" className="t-sm text-band-muted transition-colors hover:text-band-on">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="t-sm text-band-muted transition-colors hover:text-band-on">
                    Create an account
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-band-rule pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="t-xs text-band-muted">
              ScholarCircle · KNUST Computer Science &amp; Engineering · 2026
            </p>
            <p className="t-xs text-band-muted">Built for Ghana&rsquo;s connectivity realities.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
