import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from './Logo'

const PROOF = [
  ['261', 'district assembly schemes covered'],
  ['16', 'regions of Ghana supported'],
  ['98%', 'SMS open rate for deadline alerts'],
] as const

/**
 * Split shell for sign in / sign up. The left half is an ink band carrying a
 * single oversized claim; on phones it collapses to a compact header so the
 * form stays above the fold.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Brand panel */}
      <aside className="flex shrink-0 flex-col justify-between bg-band px-5 py-5 sm:px-8 lg:w-[42%] lg:max-w-xl lg:px-12 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="ScholarCircle home">
            <Logo tone="band" />
          </Link>
          <Link
            to="/"
            className="t-sm inline-flex items-center gap-1.5 font-semibold text-band-muted transition-colors hover:text-band-on lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
        </div>

        <div className="hidden lg:block">
          <p className="t-overline text-accent">Ghana&rsquo;s scholarship layer</p>
          <p className="t-display-md mt-5 text-balance text-band-on">
            Being capable on paper should be enough to be reachable in practice.
          </p>

          <dl className="mt-12 border-t border-band-rule">
            {PROOF.map(([value, label]) => (
              <div key={label} className="flex items-baseline gap-5 border-b border-band-rule py-4">
                <dd className="tabular w-20 shrink-0 font-display text-2xl font-extrabold tracking-tight text-accent">
                  {value}
                </dd>
                <dt className="t-sm text-band-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <Link
          to="/"
          className="t-sm hidden items-center gap-1.5 font-semibold text-band-muted transition-colors hover:text-band-on lg:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
