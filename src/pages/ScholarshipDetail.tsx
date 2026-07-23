import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../api/endpoints'
import type { Scholarship, MatchResult, VaultDocument } from '../data/types'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Users,
  Wallet,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Gift,
  Building2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { Card, StatusPill, ScoreRing, Badge, Progress } from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { daysUntil, formatDeadline } from '../data/mock'
import { cn } from '../lib/cn'

export default function ScholarshipDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [s, setS] = useState<Scholarship | null>(null)
  const [match, setMatch] = useState<MatchResult | null>(null)
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyError, setApplyError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Fetch the scholarship directly by id — the detail page must work for
        // ANY scholarship, not only ones the student already has a match for.
        const [scholarship, matches, docs, apps] = await Promise.all([
          api.scholarships.get(id!),
          api.matches.list().catch(() => [] as MatchResult[]),
          api.documents.list().catch(() => [] as VaultDocument[]),
          api.applications.list().catch(() => [] as any[]),
        ])
        if (cancelled) return
        setS(scholarship)
        setMatch(matches.find((m) => m.scholarship.id === id) || null)
        setDocuments(docs)
        setApplied(apps.some((a) => a.scholarshipId === id))
      } catch {
        if (!cancelled) setLoadError('We couldn’t load this scholarship. It may have closed or been removed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <div className="p-8 text-center text-ink-500">Loading scholarship…</div>
  if (loadError || !s)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-3 font-semibold text-ink-800">{loadError || 'Scholarship not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm font-semibold text-brand-600">
          ← Go back
        </button>
      </div>
    )

  const d = daysUntil(s.deadline)

  const handleApply = async () => {
    setApplying(true)
    setApplyError('')
    try {
      await api.applications.create(s.id)
      setApplied(true)
    } catch (err: any) {
      setApplyError(err?.message || 'Could not submit your application. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const haveDoc = (name: string) =>
    documents.some(
      (doc) =>
        doc.status === 'Verified' &&
        name.toLowerCase().includes(doc.name.split('(')[0].trim().toLowerCase().split(' ')[0]),
    )

  const metCount = match ? match.criteria.filter((c) => c.met).length : 0

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="relative bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
              <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
              <div className="relative flex items-start gap-4">
                <ScholarshipLogo name={s.name} provider={s.provider} initials={s.initials} color={s.logoColor} className="h-16 w-16 rounded-2xl text-lg ring-4 ring-white/20" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-extrabold">{s.name}</h1>
                    {match && <StatusPill status={match.status} />}
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-brand-100">
                    <Building2 className="h-4 w-4" /> {s.provider}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.tags.map((t) => (
                      <span key={t} className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium backdrop-blur">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Wallet, label: 'Award', value: s.amount },
                  { icon: CalendarClock, label: 'Deadline', value: formatDeadline(s.deadline) },
                  { icon: Users, label: 'Slots', value: `${s.slots}` },
                  { icon: Sparkles, label: 'Applicants', value: s.applicants.toLocaleString() },
                ].map((x) => (
                  <div key={x.label} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                    <x.icon className="h-4 w-4 text-gold-300" />
                    <p className="mt-1.5 text-[11px] text-brand-200">{x.label}</p>
                    <p className="text-sm font-semibold leading-tight">{x.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {s.origin === 'curated' && (
              <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-6 py-3">
                <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Unverified listing.</span> We couldn&apos;t reach{' '}
                  {s.provider}&apos;s website, so the award, deadline and slots above come from our
                  records rather than a live check. Confirm with the provider before applying.
                </p>
              </div>
            )}

            <div className="p-6">
              <h2 className="font-display text-lg font-bold text-ink-900">About this scholarship</h2>
              <p className="mt-2 leading-relaxed text-ink-600">{s.summary || 'No description was provided for this scholarship. Use the “View original listing” link to read the full details on the provider’s site.'}</p>

              {s.benefits.length > 0 && (
                <>
                  <h3 className="mt-6 font-semibold text-ink-900">What you get</h3>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {s.benefits.map((b) => (
                      <div key={b} className="flex items-start gap-2.5 rounded-xl bg-ink-50 p-3">
                        <Gift className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-600" />
                        <span className="text-sm text-ink-700">{b}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Eligibility breakdown — only when we actually have a match */}
          {match ? (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-ink-900">Why you match</h2>
                <span className="text-sm font-medium text-ink-500">
                  {metCount} of {match.criteria.length} criteria met
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {match.criteria.map((c) => (
                  <div
                    key={c.label}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-4',
                      c.met ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/50',
                    )}
                  >
                    {c.met ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{c.label}</p>
                      <p className="text-sm text-ink-500">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
                <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
                Eligibility is rule-based and transparent. If you do not qualify, you always see exactly why.
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold text-ink-900">Check your eligibility</h2>
              <p className="mt-2 text-sm text-ink-500">
                Complete your academic profile and we’ll score you against this scholarship’s criteria
                and tell you exactly where you stand.
              </p>
              <Link
                to="/app/settings"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Complete my profile
              </Link>
            </Card>
          )}
        </div>

        {/* Sidebar: apply */}
        <div className="space-y-6">
          <Card className="p-6 lg:sticky lg:top-24">
            {match ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-500">Match score</p>
                  <p className="font-display text-xl font-bold text-ink-900">{match.status}</p>
                </div>
                <ScoreRing score={match.score} size={64} />
              </div>
            ) : (
              <div>
                <p className="text-sm text-ink-500">Award</p>
                <p className="font-display text-xl font-bold text-ink-900">{s.amount}</p>
              </div>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Application window</span>
                <span className={cn('font-semibold', Number.isFinite(d) && d <= 7 ? 'text-rose-600' : 'text-ink-700')}>
                  {Number.isFinite(d) ? `${d} days left` : 'No deadline stated'}
                </span>
              </div>
              {Number.isFinite(d) && (
                <Progress value={Math.max(8, 100 - d * 1.2)} className="mt-2" tone={d <= 7 ? 'gold' : 'brand'} />
              )}
            </div>

            {/* Required docs */}
            {s.documents.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink-900">Required documents</h3>
                <div className="mt-3 space-y-2">
                  {s.documents.map((doc) => {
                    const have = haveDoc(doc)
                    return (
                      <div key={doc} className="flex items-center gap-2.5 text-sm">
                        <div
                          className={cn(
                            'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                            have ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-400',
                          )}
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                        </div>
                        <span className={cn('flex-1', have ? 'text-ink-700' : 'text-ink-500')}>{doc}</span>
                        {have ? <Badge tone="green">In vault</Badge> : <Badge tone="ink">Needed</Badge>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {applyError && (
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{applyError}</p>
            )}

            {applied ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-6 rounded-xl bg-emerald-50 p-4 text-center"
              >
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 font-semibold text-emerald-800">Application submitted</p>
                <p className="text-sm text-emerald-600">It’s now in your tracker and the review team has been notified.</p>
                <Link to="/app/applications" className="mt-3 inline-block text-sm font-semibold text-brand-600">
                  Track application →
                </Link>
              </motion.div>
            ) : (
              <button
                onClick={handleApply}
                disabled={applying}
                className="mt-6 w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {applying ? 'Submitting…' : 'Apply now'}
              </button>
            )}
            {s.sourceUrl && (
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700"
              >
                <ExternalLink className="h-4 w-4" /> View original listing
              </a>
            )}
            <p className="mt-3 text-center text-xs text-ink-400">
              No application fee · Documents stay encrypted
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
