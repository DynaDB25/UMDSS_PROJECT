import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, type FormCandidate } from '../api/endpoints'
import type { Scholarship, MatchResult, VaultDocument } from '../data/types'
import {
  ArrowLeft,
  Check,
  X,
  CalendarClock,
  Users,
  Wallet,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { ScholarshipLogo } from '../components/ScholarshipLogo'
import { ApplyPanel } from '../components/scholarship/ApplyPanel'
import { EmbeddedForm } from '../components/scholarship/EmbeddedForm'
import {
  buildRequirements,
  type DocType,
} from '../components/scholarship/RequirementsChecklist'
import { DetailSkeleton } from '../components/skeletons'
import { useAuth } from '../contexts/AuthContext'
import { downloadPdf } from '../lib/exportDoc'
import { classifyApplyRoute } from '../lib/applyForm'
import { daysUntil, formatDeadline } from '../data/mock'
import { formatDaysLeft, isUrgent } from '../lib/format'
import { cn } from '../lib/cn'
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, StatusPill } from '../components/ui'

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
  const [zipping, setZipping] = useState(false)
  const [findingForm, setFindingForm] = useState(false)
  // Ranked places the crawler thinks the application lives, shown when none
  // was confident enough to select automatically.
  const [candidates, setCandidates] = useState<FormCandidate[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Fetch the scholarship directly by id, the detail page must work for
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

        // No application link on file yet? Go and find it. This runs after the
        // page has rendered so the crawl never blocks the student, and the
        // server caches whatever it finds for everyone who comes next.
        if (!scholarship.applicationUrl && !scholarship.applicationEmail) {
          setFindingForm(true)
          api.scholarships
            .findForm(id!)
            .then((found) => {
              if (cancelled) return
              setCandidates(found.candidates || [])
              if (found.applicationUrl || found.applicationEmail) {
                setS((prev) =>
                  prev
                    ? {
                        ...prev,
                        applicationUrl: found.applicationUrl,
                        applicationEmail: found.applicationEmail,
                        applicationMode: found.applicationMode as any,
                      }
                    : prev,
                )
              }
            })
            .catch(() => undefined)
            .finally(() => {
              if (!cancelled) setFindingForm(false)
            })
        }
      } catch {
        if (!cancelled)
          setLoadError('We couldn’t load this scholarship. It may have closed or been removed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // Which required documents do we actually hold, matched by type the same way
  // the server does when it auto-attaches them.
  const requirements = useMemo(
    () => buildRequirements(s?.documents, documents, docTypes),
    [s?.documents, documents, docTypes],
  )

  if (loading) return <DetailSkeleton />

  if (loadError || !s)
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={loadError || 'Scholarship not found'}
        description="It may have closed, or the listing may have been removed by the funder."
        action={
          <ButtonLink to="/app/scholarships" variant="accent">
            Back to scholarships
          </ButtonLink>
        }
      />
    )

  const d = daysUntil(s.deadline)
  const haveCount = requirements.filter((r) => r.doc).length
  const metCount = match ? match.criteria.filter((c) => c.met).length : 0
  const applyRoute = classifyApplyRoute(s.applicationUrl, s.sourceUrl, s.applicationEmail)

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

  const handleDownloadDocs = async () => {
    if (!application) return
    setZipping(true)
    setApplyError('')
    try {
      const safe = s.name.replace(/[^\w\d\-. ]+/g, '').replace(/\s+/g, '_').slice(0, 50)
      await api.applications.downloadDocuments(
        String(application.id).replace('app-', ''),
        `${safe || 'application'}_documents.zip`,
      )
    } catch (err: any) {
      setApplyError(err?.message || 'Could not build the document bundle.')
    } finally {
      setZipping(false)
    }
  }

  const handleMarkSubmitted = async () => {
    if (!application) return
    setMarking(true)
    try {
      const updated = await api.applications.markSubmitted(
        String(application.id).replace('app-', ''),
      )
      setApplication(updated)
    } catch (err: any) {
      setApplyError(err?.message || 'Could not update your application.')
    } finally {
      setMarking(false)
    }
  }

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
        lines.push(
          r.doc ? `- [READY] ${r.req} (in your vault as "${r.doc.name}")` : `- [MISSING] ${r.req}`,
        )
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

  // A ready-to-send application email for funders who accept one, with the
  // student's details already written out so they only attach their documents.
  const emailHref = (() => {
    if (!applyRoute.email) return ''
    const p: any = user?.profile || {}
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    const body = [
      'Dear Scholarship Committee,',
      '',
      `I am applying for the ${s.name}.`,
      '',
      `Full name: ${name}`,
      `Email: ${user?.email || ''}`,
      p.phone ? `Phone: ${p.phone}` : '',
      p.institution || p.shs_school ? `Institution: ${p.institution || p.shs_school}` : '',
      p.programme ? `Programme: ${p.programme}` : '',
      p.university_level ? `Level: ${p.university_level}` : '',
      p.wassce_aggregate != null ? `WASSCE aggregate: ${p.wassce_aggregate}` : '',
      p.region ? `Home region: ${p.region}${p.home_district ? `, ${p.home_district}` : ''}` : '',
      '',
      'I have attached the documents listed in your requirements:',
      ...requirements.map((r) => `  - ${r.req}`),
      '',
      'Thank you for your consideration.',
      '',
      name,
    ]
      .filter(Boolean)
      .join('\n')
    return `mailto:${applyRoute.email}?subject=${encodeURIComponent(
      `Scholarship application: ${s.name}`,
    )}&body=${encodeURIComponent(body)}`
  })()

  const heroStats = [
    { icon: Wallet, label: 'Award', value: s.amount, detail: '' },
    {
      icon: CalendarClock,
      label: 'Deadline',
      value: formatDeadline(s.deadline),
      // The date alone makes a student do the arithmetic. Say it outright.
      detail: Number.isFinite(d) ? (d < 0 ? 'Closed' : formatDaysLeft(d) + ' left') : '',
    },
    { icon: Users, label: 'Slots', value: s.slots > 0 ? `${s.slots}` : 'Not stated', detail: '' },
    {
      icon: Sparkles,
      label: 'Applicants',
      value: s.applicants > 0 ? s.applicants.toLocaleString() : 'Not tracked',
      detail: '',
    },
  ]

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="t-sm inline-flex items-center gap-2 font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      {/* ---------------- Hero band ---------------- */}
      <section className="rounded-md bg-band px-5 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ScholarshipLogo
            name={s.name}
            provider={s.provider}
            initials={s.initials}
            className="h-14 w-14 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="t-overline text-accent">{s.provider}</p>
            <h1 className="t-display-md mt-2 text-balance text-band-on">{s.name}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {match && <StatusPill status={match.status} variant="solid" />}
              {s.genderScope && s.genderScope !== 'any' && (
                <Badge tone="accent" className="border-transparent bg-accent text-accent-on">
                  {s.genderScope === 'female' ? 'Women only' : 'Men only'}
                </Badge>
              )}
              {s.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-sm border border-band-rule px-2 py-0.5 text-[0.6875rem] font-semibold text-band-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-px border-t border-band-rule sm:grid-cols-4">
          {heroStats.map((x) => (
            <div key={x.label} className="border-b border-band-rule py-4 pr-4 sm:border-b-0">
              <dt className="t-overline flex items-center gap-1.5 text-band-muted">
                <x.icon className="h-3 w-3 shrink-0" aria-hidden />
                {x.label}
              </dt>
              <dd className="tabular mt-2 font-display text-base font-extrabold leading-tight tracking-tight text-band-on sm:text-lg">
                {x.value}
              </dd>
              {x.detail && (
                <dd
                  className={cn(
                    'tabular t-xs mt-1 font-semibold',
                    isUrgent(d) ? 'text-accent' : 'text-band-muted',
                  )}
                >
                  {x.detail}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>

      {s.origin === 'curated' && (
        <Alert tone="warning" title="Unverified listing">
          We couldn&apos;t reach {s.provider}&apos;s website, so the award, deadline and slots above
          come from our records rather than a live check. Confirm with the provider before applying.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* ---------------- Main ---------------- */}
        <div className="min-w-0 space-y-6">
          <Card as="section" className="px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="t-h3 text-ink">About this scholarship</h2>
            <p className="t-body mt-3 max-w-prose text-ink-secondary">
              {s.summary ||
                'No description was provided for this scholarship. Use the “View original listing” link to read the full details on the provider’s site.'}
            </p>

            {s.benefits.length > 0 && (
              <>
                <h3 className="t-overline mt-7 text-ink-muted">What you get</h3>
                <ul className="rule-list mt-2 border-t border-rule">
                  {s.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-3 py-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" aria-hidden />
                      <span className="t-body text-ink-secondary">{b}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* The provider's own form, embedded when they use a platform that
              supports it. The student fills and submits it here themselves. */}
          {application && applyRoute.embedUrl && (
            <EmbeddedForm
              provider={s.provider}
              scholarshipName={s.name}
              embedUrl={applyRoute.embedUrl}
              externalUrl={applyRoute.externalUrl}
              haveCount={haveCount}
              zipping={zipping}
              onDownloadDocs={handleDownloadDocs}
            />
          )}

          {/* Eligibility breakdown, only when we actually have a match */}
          {match ? (
            <Card as="section">
              <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
                <h2 className="t-h3 text-ink">Why you match</h2>
                <span className="tabular t-sm shrink-0 font-semibold text-ink-muted">
                  {metCount} of {match.criteria.length} met
                </span>
              </div>

              <ul className="rule-list">
                {match.criteria.map((c) => (
                  <li key={c.label} className="flex items-start gap-3.5 px-5 py-4">
                    <span
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full',
                        c.met
                          ? 'bg-state-positive text-white'
                          : 'border border-state-attention text-state-attention',
                      )}
                      aria-hidden
                    >
                      {c.met ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        <X className="h-3 w-3" strokeWidth={3} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{c.label}</p>
                      <p className="t-sm mt-0.5 text-ink-muted">{c.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="t-sm flex items-start gap-2.5 border-t border-rule px-5 py-4 text-ink-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                Eligibility is rule-based and transparent. If you do not qualify, you always see
                exactly why.
              </p>
            </Card>
          ) : (
            <Card as="section" className="px-5 py-6">
              <h2 className="t-h3 text-ink">Check your eligibility</h2>
              <p className="t-body mt-2 max-w-prose text-ink-muted">
                Complete your academic profile and we&apos;ll score you against this
                scholarship&apos;s criteria and tell you exactly where you stand.
              </p>
              <ButtonLink to="/app/settings" variant="accent" className="mt-5">
                Complete my profile
              </ButtonLink>
            </Card>
          )}

          {Number.isFinite(d) && d < 0 && (
            <Alert tone="warning" title="This deadline has passed">
              The funder may still accept late entries or reopen next cycle, check their listing
              before applying.
            </Alert>
          )}
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div className="min-w-0">
          <ApplyPanel
            scholarship={s}
            match={match}
            application={application}
            requirements={requirements}
            applyRoute={applyRoute}
            emailHref={emailHref}
            candidates={candidates}
            applyError={applyError}
            applying={applying}
            marking={marking}
            zipping={zipping}
            findingForm={findingForm}
            onApply={handleApply}
            onDownloadDocs={handleDownloadDocs}
            onDownloadPack={downloadPack}
            onMarkSubmitted={handleMarkSubmitted}
            onFormPromoted={(url) => setS((prev) => (prev ? { ...prev, applicationUrl: url } : prev))}
          />
        </div>
      </div>
    </div>
  )
}
