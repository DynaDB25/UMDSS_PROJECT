import { ExternalLink, FolderDown, Lock } from 'lucide-react'
import { Button, Card, ExternalButtonLink } from '../ui'

/**
 * The provider's own form, embedded when they use a platform that allows it.
 * Framed like a browser window so it reads unmistakably as an external site
 * rather than part of ScholarCircle.
 */
export function EmbeddedForm({
  provider,
  scholarshipName,
  embedUrl,
  externalUrl,
  haveCount,
  zipping,
  onDownloadDocs,
}: {
  provider: string
  scholarshipName: string
  embedUrl: string
  externalUrl?: string
  haveCount: number
  zipping: boolean
  onDownloadDocs: () => void
}) {
  return (
    <Card as="section" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
        <div className="min-w-0">
          <h2 className="t-h3 text-ink">Apply to {provider}</h2>
          <p className="t-sm mt-1 max-w-prose text-ink-muted">
            This is {provider}&apos;s own form. Fill it in and submit it below, then mark it
            submitted so we can track it.
          </p>
        </div>
        {externalUrl && (
          <ExternalButtonLink
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            size="sm"
            icon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            New tab
          </ExternalButtonLink>
        )}
      </div>

      {haveCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-rule bg-accent-soft px-5 py-3">
          <p className="t-sm min-w-0 flex-1 text-ink-secondary">
            Need to upload files into the form? Grab your {haveCount} vault document
            {haveCount > 1 ? 's' : ''} first.
          </p>
          <Button
            size="sm"
            onClick={onDownloadDocs}
            loading={zipping}
            icon={<FolderDown className="h-3.5 w-3.5" />}
          >
            Download ZIP
          </Button>
        </div>
      )}

      {/* Browser-chrome header makes the origin of the frame explicit */}
      <div className="flex items-center gap-2 border-b border-rule bg-surface-sunken px-4 py-2">
        <Lock className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
        <span className="t-xs truncate font-mono text-ink-muted">{externalUrl || embedUrl}</span>
      </div>

      <iframe
        src={embedUrl}
        title={`${scholarshipName} application form`}
        className="h-[600px] w-full border-0 bg-white sm:h-[720px]"
        loading="lazy"
      />

      {/* Some funders lock their form behind a Google or Microsoft sign-in, and
          those sign-in pages refuse to be framed. Nothing we can detect from
          here, so always offer the way out. */}
      <div className="t-xs border-t border-rule bg-surface-sunken px-5 py-3 text-center text-ink-muted">
        Form not loading or asking you to sign in?{' '}
        <a
          href={externalUrl || embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline underline-offset-4 hover:text-accent"
        >
          Open it in a new tab instead
        </a>
        , then come back and mark it submitted.
      </div>
    </Card>
  )
}
