import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  FolderLock,
  BellRing,
  Bot,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  MapPin,
  GraduationCap,
  Clock,
} from 'lucide-react'
import { Logo } from '../components/Logo'

const modules = [
  {
    icon: Sparkles,
    title: 'Scholarship Matching Engine',
    desc: 'Cross-references your WASSCE results, programme and home region against the published criteria of major Ghanaian funders to surface only what you qualify for.',
    color: 'from-brand-500 to-brand-700',
  },
  {
    icon: FolderLock,
    title: 'Secure Document Vault',
    desc: 'Upload your Ghana Card, transcripts and admission letter once. AES-256 encrypted, reused across every application instead of five separate portals.',
    color: 'from-violet-500 to-violet-700',
  },
  {
    icon: BellRing,
    title: 'Multi-Channel Notifications',
    desc: 'SMS-first deadline and interview alerts via the Hubtel gateway, tied to the Ghanaian academic calendar. No more missing a window by four days.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Bot,
    title: 'Decision Support Bot',
    desc: 'A rule-based assistant that answers eligibility questions in plain language and walks you through district interview preparation, any time of day.',
    color: 'from-rose-500 to-rose-700',
  },
]

const stats = [
  { value: '47%', label: 'better deadline compliance with SMS alerts' },
  { value: '98%', label: 'SMS open rate vs. a fraction for email' },
  { value: '261', label: 'MMDA district schemes covered' },
  { value: '16', label: 'regions of Ghana supported' },
]

const steps = [
  { icon: GraduationCap, title: 'Build your profile', desc: 'Enter WASSCE aggregate, programme and home region once.' },
  { icon: Sparkles, title: 'Get matched instantly', desc: 'See a ranked list of scholarships you actually qualify for.' },
  { icon: FolderLock, title: 'Apply with one vault', desc: 'Attach stored documents to any application in seconds.' },
  { icon: BellRing, title: 'Never miss a deadline', desc: 'Get SMS alerts for deadlines, status changes and interviews.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-600 md:flex">
            <a href="#modules" className="hover:text-ink-900">Modules</a>
            <a href="#how" className="hover:text-ink-900">How it works</a>
            <a href="#impact" className="hover:text-ink-900">Impact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <MapPin className="h-3.5 w-3.5" /> Built for Ghanaian tertiary students
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
              The funding exists.
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">
                We help you reach it.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
              USMDSS is a unified scholarship platform that matches you to awards you
              qualify for, secures your documents, and sends SMS alerts before deadlines
              close, so no qualified student misses out again.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-800"
              >
                Find my scholarships
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-6 py-3.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                View live demo
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-ink-500">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-600" /> No application fees</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-600" /> Works on any phone</span>
            </div>
          </motion.div>

          {/* Hero mock card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative"
          >
            <div className="animate-float-slow rounded-3xl border border-ink-200/70 bg-white p-5 shadow-2xl shadow-brand-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-ink-400">Your top match</p>
                  <p className="font-display text-lg font-bold text-ink-900">MTN Bright Scholarship</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 font-bold text-white">MB</div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">96</div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Strong match</p>
                  <p className="text-xs text-emerald-600">4 of 4 criteria met</p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {['WASSCE aggregate 8 ≤ 10 required', 'Computer Engineering · priority STEM field', 'Open to all 16 regions', 'High financial need qualifies'].map((c) => (
                  <div key={c} className="flex items-center gap-2 text-sm text-ink-600">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> {c}
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white">
                Apply with saved documents
              </button>
            </div>

            <div className="absolute -bottom-5 -left-5 flex items-center gap-3 rounded-2xl border border-ink-200/70 bg-white p-3 shadow-xl">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <Smartphone className="h-4.5 w-4.5" />
              </div>
              <div className="pr-2">
                <p className="text-xs font-semibold text-ink-800">SMS sent</p>
                <p className="text-[11px] text-ink-400">Interview · Thu 10:00 AM</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section id="impact" className="border-y border-ink-100 bg-ink-900">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 py-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="px-4 text-center">
              <p className="font-display text-3xl font-extrabold text-gold-400 sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-ink-300">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Four integrated modules</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            One platform, end to end
          </h2>
          <p className="mt-4 text-ink-600">
            Every step of the scholarship journey, from discovery to interview, handled in a single
            place designed for Ghana's connectivity realities.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group rounded-2xl border border-ink-200/70 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-ink-900/5"
            >
              <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${m.color} text-white shadow-sm`}>
                <m.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-ink-900">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              From profile to funding in four steps
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-ink-200/70 bg-white p-6">
                <div className="absolute right-5 top-5 font-display text-4xl font-extrabold text-ink-100">
                  {i + 1}
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story / why */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white sm:p-10">
            <Clock className="h-8 w-8 text-gold-400" />
            <blockquote className="mt-5 font-display text-2xl font-bold leading-snug">
              "I qualified for three scholarships. I missed the interview notification by four days
              and lost a year of funding."
            </blockquote>
            <p className="mt-4 text-brand-200">
              That experience is the reason USMDSS exists, so that being capable on paper is enough
              to be reachable in practice.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
              The problem was never a shortage of funds
            </h2>
            <p className="mt-4 text-ink-600">
              It is a shortage of access. Information sits scattered across disconnected portals.
              Deadlines pass unannounced. The same documents are reformatted again and again. USMDSS
              acts as an intelligent intermediary layer, aggregating public scholarship data and
              automating the matching and notification that currently fall short.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Encrypted document vault with full audit trail',
                'Transparent rule-based eligibility, you always see why',
                'SMS-first alerts for low-bandwidth districts',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  <span className="text-ink-700">{t}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-800"
            >
              Create your free profile <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-100 bg-ink-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
          <Logo />
          <p className="text-sm text-ink-500">
            USMDSS · A final-year project · KNUST Computer Science & Engineering · 2026
          </p>
          <div className="flex gap-5 text-sm text-ink-500">
            <a href="#modules" className="hover:text-ink-900">Modules</a>
            <a href="#how" className="hover:text-ink-900">How it works</a>
            <Link to="/login" className="hover:text-ink-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
