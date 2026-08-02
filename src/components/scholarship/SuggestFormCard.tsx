import { useState } from 'react'
import { api } from '../../api/endpoints'
import { Button, Input } from '../ui'

/**
 * Nothing found automatically. The student who is on the funder's site can see
 * the real link, so let them pass it on, two independent reports promote it
 * platform-wide.
 */
export function SuggestFormCard({
  scholarshipId,
  provider,
  onPromoted,
}: {
  scholarshipId: string
  provider: string
  onPromoted: (url: string) => void
}) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const r = await api.scholarships.suggestForm(scholarshipId, url.trim())
      if (r.promoted && r.applicationUrl) {
        onPromoted(r.applicationUrl)
        setMessage('Confirmed. This link is now live for every student.')
      } else {
        setMessage(
          `Thank you. ${r.votes} of ${r.needed} students have reported this link, so it goes live once one more agrees.`,
        )
      }
      setUrl('')
    } catch (err: any) {
      setMessage(err?.message || 'Could not save that link.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-rule bg-surface-sunken p-4">
      <p className="text-[0.8125rem] font-semibold text-ink">Found where to apply?</p>
      <p className="t-xs mt-1 text-ink-muted">
        We could not find {provider}&apos;s form. Paste the link and we will save it for every
        student after you.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          aria-label="Application form URL"
          inputSize="sm"
          type="url"
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" loading={saving} disabled={!url.trim()} className="shrink-0">
          Share
        </Button>
      </div>
      {message && <p className="t-xs mt-2.5 font-medium text-ink-secondary">{message}</p>}
    </form>
  )
}
