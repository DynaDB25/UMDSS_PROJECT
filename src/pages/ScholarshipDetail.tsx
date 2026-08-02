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
  FileDown,
  Send,
} from 'lucide-react'
import { Card, StatusPill, ScoreRing, Badge, Progress } from '../components/ui'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { useAuth } from '../contexts/AuthContext'
import { downloadPdf } from '../lib/exportDoc'
import { daysUntil, formatDeadline } from '../data/mock'
import { cn } from '../lib/cn'

type DocType = { key: string; label: string; category: string; keywords: string[] }

/** Mirror of the backend's requirement matcher so the UI predicts exactly what
 *  the server will auto-attach when the student applies. */
function matchRequirement(text: string, types: DocType[]): string | null {
  const t = ` ${(text || '').toLowerCase()} `
  for (const d of types) {
    for (const kw of d.keywords || []) {
      if (kw && t.includes(kw)) return d.key
    }
  }
  return null
}

export default function ScholarshipDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { user } = useAuth()
  const [s, setS] = useState<Scholarship | null>(null)
  const [match, setMatch] = useState<MatchResult | null>(null)
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  // The tracked application for this scholarship, once one exists.
  const [application, setApplication] = useState<any | null>(null)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Fetch the scholarship directly by id — the detail page must work for
        // ANY scholarship, not only ones the student already has a match for.
        const [scholarship, matches, docs, apps, ref] = await Promise.all([
          api.scholarships.get(id!),
          api.matches.list().catch(() => [] as MatchResult[]),
          api.documents.list().catch(() => [] as VaultDocument[]),
          api.applications.list().catch(() => [] as any[]),
          api.reference().catch(() => ({ documentTypes: [] as DocType[] } as any)),
        ])
        if (cancelled) return
        setS(scholarship)
        setMatch(matches.find((m) => m.scholarship.id === id) || null)
        setDocuments(docs)
        setDocTypes(ref?.documentTypes || [])
        setApplication(apps.find((a) => a.scholarshipId === id) || null)
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
      const app = await api.applications.create(s.id)
      setApplication(app)
    } catch (err: any) {
      setApplyError(err?.message || 'Could not start your application. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const handleMarkSubmitted = async () => {
    if (!application) return
    setMarking(true)
    try {
      const updated = await api.applications.markSubmitted(String(application.id).replace('app-', ''))
      setApplication(updated)
    } catch (err: any) {
      setApplyError(err?.message || 'Could not update your application.')
    } finally {
      setMarking(false)
    }
  }

  // Which required documents do we actually hold, matched by type the same way
  // the server does when it auto-attaches them.
  const requirements = (s.documents || []).map((req) => {
    const key = matchRequirement(req, docTypes)
    const doc = key ? documents.find((d: any) => d.docType === key) : undefined
    return { req, key, doc }
  })
  const haveCount = requirements.filter((r) => r.doc).length
  const missing = requirements.filter((r) => !r.doc)

  // A printable pack the student can take to the funder's own form.
  const downloadPack = () => {
    const p: any = user?.profile || {}
    const lines: string[] = [
      `# ${s.name}`,
      `**Provider:** ${s.provider}`,
      `**Award:** ${s.amount}`,
      `**Deadline:** ${formatDeadline(s.deadline)}`,
      s.applicationUrl ? `**Apply at:** ${s.applicationUrl}` : '',
      s.applicationEmail ? `**Send to:** ${s.applicationEmail}` : '',
      '',
      '## Applicant details',
      `**Full name:** ${[user?.first_name, user?.last_name].filter(Boolean).join(' ')}`,
      `**Email:** ${user?.email || ''}`,
      p.phone ? `**Phone:** ${p.phone}` : '',
      p.student_type ? `**Student type:** ${p.student_type}` : '',
      p.institution ? `**Institution:** ${p.institution}` : '',
      p.shs_school ? `**Senior high school:** ${p.shs_school}` : '',
      p.programme ? `**Programme:** ${p.programme}` : '',
      p.university_level ? `**Level:** ${p.university_level}` : '',
      p.academic_standing ? `**Academic standing:** ${p.academic_standing}` : '',
      p.wassce_aggregate != null ? `**WASSCE aggregate:** ${p.wassce_aggregate}` : '',
      p.region ? `**Home region:** ${p.region}` : '',
      p.home_district ? `**Home district:** ${p.home_district}` : '',
      p.gender ? `**Gender:** ${p.gender}` : '',
      p.need_level ? `**Financial need:** ${p.need_level}` : '',
      '',
      '## Document checklist',
    ]
    if (requirements.length === 0) {
      lines.push('This funder did not publish a document list. Confirm requirements on their site.')
    } else {
      for (const r of requirements) {
        lines.push(r.doc ? `- [READY] ${r.req} (in your vault as "${r.doc.name}")` : `- [MISSING] ${r.req}`)
      }
    }
    lines.push(
      '',
      '## Next steps',
      '1. Download your documents from the ScholarCircle vault.',
      s.applicationUrl
        ? `2. Open the provider form at ${s.applicationUrl} and fill it with the details above.`
        : '2. Open the provider website and fill their form with the details above.',
      '3. Attach every document on the checklist.',
      '4. Submit to the provider, then mark it submitted in ScholarCircle to track it.',
      '',
      'Prepared by ScholarCircle. Always confirm requirements and deadlines with the provider.',
    )
    downloadPdf(`${s.name} application pack`, lines.filter(Boolean).join('\n'))
  }

  const metCount = match ? match.criteria.filter((c) => c.met).length : 0
  const applyLink = s.applicationUrl || s.sourceUrl

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
                    {s.genderScope && s.genderScope !== 'any' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-gold-400/90 px-2 py-0.5 text-xs font-bold text-ink-900">
                        <Users className="h-3 w-3" />
                        {s.genderScope === 'female' ? 'Women only' : 'Men only'}
                      </span>
                    )}
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

            {/* Required docs, matched against the vault by type */}
            {requirements.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-900">Required documents</h3>
                  <span className={cn('text-xs font-semibold', haveCount === requirements.length ? 'text-emerald-600' : 'text-amber-600')}>
                    {haveCount}/{requirements.length} ready
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {requirements.map((r) => (
                    <div key={r.req} className="flex items-center gap-2.5 text-sm">
                      <div
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                          r.doc ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-400',
                        )}
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                      </div>
                      <span className={cn('flex-1', r.doc ? 'text-ink-700' : 'text-ink-500')}>{r.req}</span>
                      {r.doc ? <Badge tone="green">In vault</Badge> : <Badge tone="ink">Needed</Badge>}
                    </div>
                  ))}
                </div>
                {missing.length > 0 && (
                  <Link
                    to="/app/vault"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Upload the {missing.length} missing document{missing.length > 1 ? 's' : ''} →
                  </Link>
                )}
              </div>
            )}

            {applyError && (
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{applyError}</p>
            )}

            {application ? (
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-6 space-y-3"
              >
                {application.status === 'Draft' ? (
                  <>
                    <div className="rounded-xl bg-brand-50 p-4">
                      <p className="font-semibold text-brand-900">Your application pack is ready</p>
                      <p className="mt-1 text-sm text-brand-700">
                        {requirements.length > 0
                          ? `${haveCount} of ${requirements.length} required documents are in your vault.`
                          : 'This funder did not publish a document list.'}
                      </p>
                      <p className="mt-2 text-sm text-brand-700">
                        ScholarCircle does not submit on your behalf. Finish on {s.provider}&apos;s own
                        form, then mark it submitted here so we can track it.
                      </p>
                    </div>

                    {applyLink && (
                      <a
                        href={applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm hover:bg-brand-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {s.applicationUrl ? 'Open the application form' : 'Open the provider listing'}
                      </a>
                    )}

                    {s.applicationEmail && (
                      <a
                        href={`mailto:${s.applicationEmail}?subject=${encodeURIComponent(`Scholarship application: ${s.name}`)}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                      >
                        <Send className="h-4 w-4" /> Email {s.applicationEmail}
                      </a>
                    )}

                    <button
                      onClick={downloadPack}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                    >
                      <FileDown className="h-4 w-4" /> Download application pack (PDF)
                    </button>

                    <button
                      onClick={handleMarkSubmitted}
                      disabled={marking}
                      className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {marking ? 'Saving…' : 'I have submitted this'}
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl bg-emerald-50 p-4 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-2 font-semibold text-emerald-800">Marked as submitted</p>
                    <p className="text-sm text-emerald-600">
                      Submitted on {application.submittedOn}. We will keep it in your tracker.
                    </p>
                  </div>
                )}

                <Link
                  to="/app/applications"
                  className="block text-center text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Track this application →
                </Link>
              </motion.div>
            ) : (
              <>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="mt-6 w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {applying ? 'Preparing…' : 'Start my application'}
                </button>
                <p className="mt-2 text-center text-xs text-ink-500">
                  We build your pack and attach your vault documents, then hand you straight to{' '}
                  {s.provider}.
                </p>
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
              </>
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
