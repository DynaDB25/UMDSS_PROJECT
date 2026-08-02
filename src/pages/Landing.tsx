import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  BellRing,
  Bot,
  FolderLock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { FunderMarquee } from '../components/marketing/FunderMarquee'
import { Button, ButtonLink, ScoreRing, StatusPill } from '../components/ui'
import { fadeUp, inView, listItem, stagger } from '../lib/motion'

const modules = [
  {
    icon: Sparkles,
    title: 'Scholarship matching engine',
    desc: 'Cross-references your WASSCE results, programme and home region against the published criteria of major Ghanaian funders, then shows you only what you actually qualify for — and why.',
  },
  {
    icon: FolderLock,
    title: 'Secure document vault',
    desc: 'Upload your Ghana Card, transcripts and admission letter once. AES-256 encrypted at rest, then reused across every application instead of five separate portals.',
  },
  {
    icon: BellRing,
    title: 'Multi-channel notifications',
    desc: 'SMS-first deadline and interview alerts through the Hubtel gateway, tied to the Ghanaian academic calendar. No more losing a window by four days.',
  },
  {
    icon: Bot,
    title: 'Decision support bot',
    desc: 'An assistant grounded in your own profile and matches. It answers eligibility questions in plain language and walks you through interview preparation, any time of day.',
  },
]

const stats = [
  { value: '47%', label: 'Better deadline compliance with SMS alerts' },
  { value: '98%', label: 'SMS open rate, against a fraction for email' },
  { value: '261', label: 'MMDA district schemes covered' },
  { value: '16', label: 'Regions of Ghana supported' },
]

const steps = [
  { n: '01', title: 'Build your profile', desc: 'Enter your WASSCE aggregate, programme and home region once.' },
  { n: '02', title: 'Get matched', desc: 'See a ranked list of awards you qualify for, with the reasoning shown.' },
  { n: '03', title: 'Apply from one vault', desc: 'Attach stored documents to any application in seconds.' },
  { n: '04', title: 'Never miss a deadline', desc: 'SMS alerts for deadlines, status changes and interviews.' },
]

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
      className={`sticky top-0 z-40 transition-colors duration-[--dur] ${
        scrolled ? 'border-b border-rule bg-canvas/95 backdrop-blur' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="ScholarCircle home" className="shrink-0">
          <Logo size="sm" className="sm:hidden" />
          <Logo className="hidden sm:flex" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            ['What it does', '#modules'],
            ['How it works', '#how'],
            ['Impact', '#impact'],
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

/** A real slice of the product, built from the same primitives the app uses. */
function HeroPreview() {
  const criteria = [
    'WASSCE aggregate 8 — within the required 10',
    'Computer Engineering — priority STEM field',
    'Open to all 16 regions',
    'High financial need qualifies',
  ]

  return (
    <div className="rounded-lg border border-rule bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <p className="t-overline text-ink-muted">Your top match</p>
        <StatusPill status="Strong match" />
      </div>

      <div className="flex items-start gap-4 px-4 py-5 sm:px-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-ink font-display text-sm font-bold text-canvas">
          MB
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="t-h3 truncate text-ink">MTN Bright Scholarship</h3>
          <p className="t-sm mt-0.5 truncate text-ink-muted">MTN Ghana Foundation · Corporate</p>
          <p className="tabular mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">
            GH₵ 12,000
            <span className="t-sm ml-2 font-sans font-medium text-ink-muted">per year</span>
          </p>
        </div>
        <ScoreRing score={96} size={52} />
      </div>

      <ul className="rule-list border-t border-rule">
        {criteria.map((c) => (
          <li key={c} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-state-positive" aria-hidden />
            <span className="t-sm text-ink-secondary">{c}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-rule p-4 sm:p-5">
        <Button variant="accent" block iconRight={<ArrowRight className="h-4 w-4" />}>
          Apply with saved documents
        </Button>
        <p className="t-xs mt-3 text-center text-ink-muted">
          4 documents attach automatically from your vault
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      {/* ---------------- Hero ---------------- */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-14 lg:py-28">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger(0, 0.08)}
            className="lg:col-span-7"
          >
            <motion.p variants={fadeUp} className="t-overline flex items-center gap-2.5 text-ink-muted">
              <span className="h-1.5 w-1.5 rotate-45 bg-accent" aria-hidden />
              For Ghanaian tertiary students
            </motion.p>

            <motion.h1 variants={fadeUp} className="t-display-xl mt-5 text-balance text-ink">
              The funding exists.
              <br />
              <span className="text-accent">We help you reach it.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="t-body-lg mt-6 max-w-xl text-ink-secondary">
              ScholarCircle matches you to awards you actually qualify for, keeps your documents in
              one encrypted vault, and sends an SMS before every deadline closes — so no qualified
              student misses out again.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                to="/register"
                variant="accent"
                size="lg"
                className="w-full justify-center sm:w-auto"
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Find my scholarships
              </ButtonLink>
              <ButtonLink
                to="/login"
                variant="outline"
                size="lg"
                className="w-full justify-center sm:w-auto"
              >
                Sign in
              </ButtonLink>
            </motion.div>

            <motion.ul
              variants={fadeUp}
              className="mt-9 flex flex-wrap gap-x-7 gap-y-2.5 border-t border-rule pt-6"
            >
              {['No application fees', 'Works on any phone', 'Free for students'].map((t) => (
                <li key={t} className="t-sm flex items-center gap-2 text-ink-muted">
                  <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0, 0, 1] }}
            className="lg:col-span-5"
          >
            <HeroPreview />
          </motion.div>
        </div>
      </section>

      <FunderMarquee />

      {/* ---------------- Impact ---------------- */}
      <section id="impact" className="scroll-mt-16 bg-band">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <motion.div {...inView} variants={stagger(0, 0.07)}>
            <motion.p variants={fadeUp} className="t-overline text-accent">
              Why it matters
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="t-display-md mt-4 max-w-2xl text-balance text-band-on"
            >
              The problem was never a shortage of funds.
            </motion.h2>

            <motion.dl
              variants={stagger(0.1, 0.06)}
              className="mt-12 grid gap-px border-t border-band-rule sm:grid-cols-2 lg:grid-cols-4"
            >
              {stats.map((s) => (
                <motion.div
                  key={s.label}
                  variants={listItem}
                  className="border-b border-band-rule py-7 sm:border-r sm:pr-6 sm:last:border-r-0 lg:pr-8"
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <p className="tabular font-display text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-none tracking-[-0.04em] text-accent">
                      {s.value}
                    </p>
                    <p className="t-sm mt-3 max-w-[22ch] text-band-muted">{s.label}</p>
                  </dd>
                </motion.div>
              ))}
            </motion.dl>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Modules ---------------- */}
      <section id="modules" className="scroll-mt-16 border-b border-rule">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <motion.div {...inView} variants={stagger(0, 0.07)}>
            <motion.p variants={fadeUp} className="t-overline text-ink-muted">
              Four integrated modules
            </motion.p>
            <motion.h2 variants={fadeUp} className="t-display-md mt-4 max-w-2xl text-balance text-ink">
              One platform, discovery through interview.
            </motion.h2>
          </motion.div>

          <motion.ol {...inView} variants={stagger(0.1, 0.07)} className="mt-12 border-t border-rule">
            {modules.map((m, i) => (
              <motion.li
                key={m.title}
                variants={listItem}
                className="group grid gap-x-8 gap-y-3 border-b border-rule py-8 transition-colors duration-[--dur] hover:bg-surface-sunken sm:py-10 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start"
              >
                <span className="tabular font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.04em] text-rule-strong transition-colors duration-[--dur] group-hover:text-accent md:text-[3.5rem]">
                  0{i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="t-h2 text-ink">{m.title}</h3>
                  <p className="t-body mt-3 max-w-prose text-ink-secondary">{m.desc}</p>
                </div>
                <m.icon
                  className="hidden h-6 w-6 shrink-0 text-ink-faint transition-colors duration-[--dur] group-hover:text-ink md:block"
                  aria-hidden
                />
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="scroll-mt-16 border-b border-rule bg-surface-sunken">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <motion.div {...inView} variants={stagger(0, 0.07)}>
            <motion.p variants={fadeUp} className="t-overline text-ink-muted">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} className="t-display-md mt-4 max-w-2xl text-balance text-ink">
              From profile to funding in four steps.
            </motion.h2>
          </motion.div>

          <motion.ol
            {...inView}
            variants={stagger(0.1, 0.07)}
            className="mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-4"
          >
            {steps.map((s) => (
              <motion.li
                key={s.n}
                variants={listItem}
                className="border-t-2 border-ink pt-5 sm:pr-6 lg:pr-8"
              >
                <span className="tabular t-overline text-accent">{s.n}</span>
                <h3 className="t-h3 mt-3 text-ink">{s.title}</h3>
                <p className="t-sm mt-2 text-ink-muted">{s.desc}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---------------- Quote ---------------- */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center">
          <motion.blockquote {...inView} variants={fadeUp} className="relative">
            <span
              className="block font-display text-6xl font-extrabold leading-none text-accent"
              aria-hidden
            >
              &ldquo;
            </span>
            <p className="t-display-md mt-2 text-balance text-ink">
              I qualified for three scholarships. I missed the interview notification by four days
              and lost a year of funding.
            </p>
            <footer className="t-sm mt-6 border-t border-rule pt-5 text-ink-muted">
              The experience that ScholarCircle was built to prevent — so that being capable on
              paper is enough to be reachable in practice.
            </footer>
          </motion.blockquote>

          <motion.div {...inView} variants={stagger(0.1, 0.06)}>
            <motion.h2 variants={fadeUp} className="t-h1 text-balance text-ink">
              It is a shortage of access.
            </motion.h2>
            <motion.p variants={fadeUp} className="t-body mt-5 max-w-prose text-ink-secondary">
              Information sits scattered across disconnected portals. Deadlines pass unannounced.
              The same documents get reformatted again and again. ScholarCircle acts as the
              intermediary layer — aggregating public scholarship data and automating the matching
              and notification that currently fall short.
            </motion.p>
            <motion.ul variants={stagger(0.15, 0.06)} className="mt-8 rule-list border-y border-rule">
              {[
                'Encrypted document vault with a full audit trail',
                'Transparent, rule-based eligibility — you always see why',
                'SMS-first alerts built for low-bandwidth districts',
              ].map((t) => (
                <motion.li key={t} variants={listItem} className="flex items-start gap-3 py-4">
                  <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" aria-hidden />
                  <span className="t-body text-ink-secondary">{t}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="bg-accent">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="t-overline text-accent-on/70">Free for students</p>
            <h2 className="t-display-md mt-4 max-w-xl text-balance text-accent-on">
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
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2">
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
                  ['What it does', '#modules'],
                  ['How it works', '#how'],
                  ['Impact', '#impact'],
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
