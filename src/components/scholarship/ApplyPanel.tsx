import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileDown,
  FolderDown,
  Send,
} from 'lucide-react'
import type { MatchResult, Scholarship } from '../../data/types'
import type { ApplyRoute } from '../../lib/applyForm'
import { daysUntil } from '../../data/mock'
import { cn } from '../../lib/cn'
import { Alert, Button, Card, ExternalButtonLink, Progress, ScoreRing } from '../ui'
import { RequirementsChecklist, type Requirement } from './RequirementsChecklist'
import { SuggestFormCard } from './SuggestFormCard'

export function ApplyPanel({
  scholarship: s,
  match,
  application,
  requirements,
  applyRoute,
  emailHref,
  applyError,
  applying,
  marking,
  zipping,
  findingForm,
  onApply,
  onDownloadDocs,
  onDownloadPack,
  onMarkSubmitted,
  onFormPromoted,
}: {
  scholarship: Scholarship
  match: MatchResult | null
  application: any | null
  requirements: Requirement[]
  applyRoute: ApplyRoute
  emailHref: string
  applyError: string
  applying: boolean
  marking: boolean
  zipping: boolean
  findingForm: boolean
  onApply: () => void
  onDownloadDocs: () => void
  onDownloadPack: () => void
  onMarkSubmitted: () => void
  onFormPromoted: (url: string) => void
}) {
  const d = daysUntil(s.deadline)
  const haveCount = requirements.filter((r) => r.doc).length
  const closingSoon = Number.isFinite(d) && d <= 7

  return (
    <Card as="section" className="overflow-hidden lg:sticky lg:top-24">
      {/* Score / award */}
      <div className="flex items-center justify-between gap-4 px-5 py-5">
        {match ? (
          <>
            <div className="min-w-0">
              <p className="t-overline text-ink-muted">Match score</p>
              <p className="t-h3 mt-1.5 truncate text-ink">{match.status}</p>
            </div>
            <ScoreRing score={match.score} size={60} />
          </>
        ) : (
          <div className="min-w-0">
            <p className="t-overline text-ink-muted">Award</p>
            <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink">
              {s.amount}
            </p>
          </div>
        )}
      </div>

      {/* Deadline */}
      <div className="border-t border-rule px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="t-sm text-ink-muted">Application window</span>
          <span
            className={cn(
              'tabular text-[0.8125rem] font-bold',
              Number.isFinite(d) ? (closingSoon ? 'text-state-negative' : 'text-ink') : 'text-ink-muted',
            )}
          >
            {Number.isFinite(d) ? (d < 0 ? 'Closed' : `${d} days left`) : 'No deadline stated'}
          </span>
        </div>
        {Number.isFinite(d) && d >= 0 && (
          <Progress
            value={Math.max(8, 100 - d * 1.2)}
            className="mt-2.5"
            tone={closingSoon ? 'attention' : 'ink'}
          />
        )}
      </div>

      <RequirementsChecklist requirements={requirements} />

      <div className="space-y-3 border-t border-rule px-5 py-5">
        {applyError && <Alert tone="danger">{applyError}</Alert>}

        {application ? (
          application.status === 'Draft' ? (
            <>
              <div className="rounded-md border border-rule bg-surface-sunken p-4">
                <p className="text-sm font-semibold text-ink">Your application pack is ready</p>
                <p className="t-sm mt-1.5 text-ink-muted">
                  {requirements.length > 0
                    ? `${haveCount} of ${requirements.length} required documents are in your vault.`
                    : 'This funder did not publish a document list.'}
                </p>
                <p className="t-sm mt-2 text-ink-muted">
                  ScholarCircle does not submit on your behalf. Finish on {s.provider}&apos;s own
                  form, then mark it submitted here so we can track it.
                </p>
              </div>

              {findingForm && (
                <div className="t-sm flex items-center gap-2.5 rounded-md border border-rule px-3 py-2.5 text-ink-muted">
                  <span
                    className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent"
                    aria-hidden
                  />
                  Looking for {s.provider}&apos;s application form…
                </div>
              )}

              {applyRoute.embedUrl ? (
                <Alert tone="success" title="The application form is open below">
                  Fill it in on this page, then come back here and mark it submitted.
                </Alert>
              ) : (
                applyRoute.externalUrl && (
                  <ExternalButtonLink
                    href={applyRoute.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="accent"
                    size="lg"
                    block
                    icon={<ExternalLink className="h-4 w-4" />}
                  >
                    {s.applicationUrl ? 'Open the application form' : 'Open the provider listing'}
                  </ExternalButtonLink>
                )
              )}

              {emailHref && (
                <ExternalButtonLink
                  href={emailHref}
                  variant="subtle"
                  block
                  icon={<Send className="h-4 w-4" />}
                >
                  Email my application
                </ExternalButtonLink>
              )}

              {haveCount > 0 && (
                <Button
                  variant="primary"
                  block
                  loading={zipping}
                  onClick={onDownloadDocs}
                  icon={<FolderDown className="h-4 w-4" />}
                >
                  Download my {haveCount} document{haveCount > 1 ? 's' : ''} (ZIP)
                </Button>
              )}

              <Button
                variant="subtle"
                block
                onClick={onDownloadPack}
                icon={<FileDown className="h-4 w-4" />}
              >
                Download application pack (PDF)
              </Button>

              <Button variant="outline" block loading={marking} onClick={onMarkSubmitted}>
                I have submitted this
              </Button>

              {!findingForm && !applyRoute.externalUrl && !applyRoute.email && (
                <SuggestFormCard
                  scholarshipId={s.id}
                  provider={s.provider}
                  onPromoted={onFormPromoted}
                />
              )}
            </>
          ) : (
            <div className="rounded-md border border-state-positive/30 bg-state-positive-soft p-4 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-state-positive" aria-hidden />
              <p className="mt-2.5 text-sm font-semibold text-state-positive">Marked as submitted</p>
              <p className="t-sm mt-1 text-state-positive/80">
                Submitted on {application.submittedOn}. We will keep it in your tracker.
              </p>
            </div>
          )
        ) : (
          <>
            <Button variant="accent" size="lg" block loading={applying} onClick={onApply}>
              Start my application
            </Button>
            <p className="t-xs text-center text-ink-muted">
              {applyRoute.embedUrl
                ? `We attach your vault documents and open ${s.provider}'s form right here on this page.`
                : `We build your pack and attach your vault documents, then hand you straight to ${s.provider}.`}
            </p>
            {s.sourceUrl && (
              <ExternalButtonLink
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="subtle"
                block
                icon={<ExternalLink className="h-4 w-4" />}
              >
                View original listing
              </ExternalButtonLink>
            )}
          </>
        )}

        {application && (
          <Link
            to="/app/applications"
            className="t-sm flex items-center justify-center gap-1.5 pt-1 font-semibold text-ink underline underline-offset-4 hover:text-accent"
          >
            Track this application
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}

        <p className="t-xs pt-1 text-center text-ink-faint">
          No application fee · Documents stay encrypted
        </p>
      </div>
    </Card>
  )
}
