import { useState } from 'react'
import { ArrowUpRight, Check, ExternalLink, FileDown, Search, Sparkles } from 'lucide-react'
import { api } from '../../api/endpoints'
import type { FormCandidate } from '../../api/endpoints'
import { cn } from '../../lib/cn'
import { Alert, Button, ExternalButtonLink, Input } from '../ui'

/**
 * What the app shows when it could not confirm a single application link.
 *
 * The old fallback was an empty box asking the student to paste a URL, which
 * is the app handing its hardest problem back to the person least equipped to
 * solve it. This instead shows the shortlist the crawler actually produced,
 * lets one click confirm the right one, and offers the searches a student
 * would otherwise run by hand.
 */

const KIND_LABEL: Record<string, string> = {
  form: 'Online form',
  portal: 'Application portal',
  document: 'Downloadable form',
  page: 'Application page',
}

function confidenceLabel(score: number) {
  if (score >= 80) return { text: 'Very likely', cls: 'text-state-positive border-state-positive/40' }
  if (score >= 55) return { text: 'Likely', cls: 'text-state-attention border-state-attention/40' }
  return { text: 'Possible', cls: 'text-ink-muted border-rule' }
}

export function WhereToApply({
  scholarshipId,
  name,
  provider,
  sourceUrl,
  candidates,
  onConfirmed,
}: {
  scholarshipId: string
  name: string
  provider: string
  sourceUrl?: string
  candidates: FormCandidate[]
  onConfirmed: (url: string) => void
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')

  const report = async (url: string) => {
    setConfirming(url)
    setMessage('')
    try {
      const r = await api.scholarships.suggestForm(scholarshipId, url)
      if (r.promoted && r.applicationUrl) {
        onConfirmed(r.applicationUrl)
        setMessage('Confirmed. This link is now live for every student.')
      } else {
        setMessage(
          `Thank you. ${r.votes} of ${r.needed} students have confirmed this, so it goes live once one more agrees.`,
        )
      }
      setPasted('')
      setPasteOpen(false)
    } catch (err: any) {
      setMessage(err?.message || 'Could not save that link.')
    } finally {
      setConfirming(null)
    }
  }

  const searchQuery = `${name} ${provider} application form`.trim()
  const searches = [
    {
      label: 'Search the web for the form',
      href: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
    },
    {
      label: `Search ${provider}'s site`,
      href: `https://duckduckgo.com/?q=${encodeURIComponent(`${provider} scholarship apply`)}`,
    },
  ]

  return (
    <section className="rounded-md border border-rule bg-surface-sunken p-4">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-ink">
            {candidates.length > 0 ? 'Where to apply' : 'We could not confirm the form'}
          </p>
          <p className="t-xs mt-1 text-ink-muted">
            {candidates.length > 0
              ? `We could not confirm one with certainty, so here is what the crawler found on ${provider}'s pages. Open one, and tell us if it is right.`
              : `${provider} does not publish an application link we can reach. These searches are the fastest way to find it.`}
          </p>
        </div>
      </div>

      {candidates.length > 0 && (
        <ul className="rule-list mt-4 border-y border-rule">
          {candidates.map((c) => {
            const conf = confidenceLabel(c.score)
            return (
              <li key={c.url} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-semibold text-ink">
                      {KIND_LABEL[c.kind] || 'Application page'}
                      <span className="ml-2 font-normal text-ink-muted">{c.host}</span>
                    </p>
                    <p className="t-xs mt-0.5 text-ink-muted">{c.reason}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide',
                      conf.cls,
                    )}
                  >
                    {conf.text}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <ExternalButtonLink
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="subtle"
                    size="sm"
                    icon={
                      c.kind === 'document' ? (
                        <FileDown className="h-3.5 w-3.5" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    Open
                  </ExternalButtonLink>
                  <Button
                    size="sm"
                    variant="accent"
                    loading={confirming === c.url}
                    onClick={() => report(c.url)}
                    icon={<Check className="h-3.5 w-3.5" />}
                  >
                    This is the one
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {searches.map((s) => (
          <ExternalButtonLink
            key={s.href}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            size="sm"
            icon={<Search className="h-3.5 w-3.5" />}
          >
            {s.label}
          </ExternalButtonLink>
        ))}
        {sourceUrl && (
          <ExternalButtonLink
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            size="sm"
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          >
            Original listing
          </ExternalButtonLink>
        )}
      </div>

      {message && (
        <Alert tone="success" className="mt-4">
          {message}
        </Alert>
      )}

      {/* Last resort, deliberately quiet */}
      <div className="mt-4 border-t border-rule pt-3">
        {pasteOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (pasted.trim()) report(pasted.trim())
            }}
            className="flex gap-2"
          >
            <Input
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://…"
              aria-label="Application form URL"
              inputSize="sm"
              type="url"
              autoFocus
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              size="sm"
              loading={confirming === pasted.trim()}
              disabled={!pasted.trim()}
              className="shrink-0"
            >
              Share
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="t-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Found it somewhere else? Paste the link
          </button>
        )}
      </div>
    </section>
  )
}
