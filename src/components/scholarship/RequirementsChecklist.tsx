import { Link } from 'react-router-dom'
import { Check, Upload } from 'lucide-react'
import type { VaultDocument } from '../../data/types'
import { cn } from '../../lib/cn'

export type DocType = { key: string; label: string; category: string; keywords: string[] }

export type Requirement = { req: string; key: string | null; doc?: VaultDocument }

/**
 * Mirror of the backend's requirement matcher so the UI predicts exactly what
 * the server will auto-attach when the student applies.
 */
export function matchRequirement(text: string, types: DocType[]): string | null {
  const t = ` ${(text || '').toLowerCase()} `
  for (const d of types) {
    for (const kw of d.keywords || []) {
      if (kw && t.includes(kw)) return d.key
    }
  }
  return null
}

export function buildRequirements(
  docs: string[] | undefined,
  vault: VaultDocument[],
  docTypes: DocType[],
): Requirement[] {
  return (docs || []).map((req) => {
    const key = matchRequirement(req, docTypes)
    const doc = key ? vault.find((d: any) => d.docType === key) : undefined
    return { req, key, doc }
  })
}

export function RequirementsChecklist({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0) return null

  const haveCount = requirements.filter((r) => r.doc).length
  const missing = requirements.filter((r) => !r.doc)
  const allReady = haveCount === requirements.length

  return (
    <section className="border-t border-rule px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="t-overline text-ink-muted">Required documents</h3>
        <span
          className={cn(
            'tabular text-[0.6875rem] font-bold',
            allReady ? 'text-state-positive' : 'text-state-attention',
          )}
        >
          {haveCount}/{requirements.length} ready
        </span>
      </div>

      <ul className="rule-list mt-3">
        {requirements.map((r) => (
          <li key={r.req} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                'grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border',
                r.doc
                  ? 'border-state-positive bg-state-positive text-white'
                  : 'border-rule-strong text-transparent',
              )}
              aria-hidden
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className={cn('t-sm min-w-0 flex-1', r.doc ? 'text-ink' : 'text-ink-muted')}>
              {r.req}
            </span>
            <span
              className={cn(
                'shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide',
                r.doc ? 'text-state-positive' : 'text-ink-faint',
              )}
            >
              {r.doc ? 'In vault' : 'Needed'}
            </span>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <Link
          to="/app/vault"
          className="t-xs mt-3 inline-flex items-center gap-1.5 font-semibold text-ink underline underline-offset-4 hover:text-accent"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Upload the {missing.length} missing document{missing.length > 1 ? 's' : ''}
        </Link>
      )}
    </section>
  )
}
