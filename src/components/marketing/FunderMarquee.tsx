const FUNDERS = [
  'GETFund',
  'MTN Ghana Foundation',
  'Mastercard Foundation',
  'Chevening',
  'DAAD',
  'Commonwealth',
  'Stanbic Bank',
  'UNESCO',
  'Rotary International',
  'British Council',
  'World Bank',
  'Scholarship Secretariat',
]

/**
 * Funder names as plain type rather than logos: it keeps the landing page free
 * of third-party favicon lookups and reads as an editorial credit line.
 */
export function FunderMarquee() {
  return (
    <div className="overflow-hidden border-y border-band-rule bg-band py-5">
      <p className="sr-only">
        Funders covered include {FUNDERS.join(', ')} and hundreds of district assembly schemes.
      </p>
      <div className="flex w-max animate-marquee gap-10 pr-10" aria-hidden>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-10">
            {FUNDERS.map((f) => (
              <span key={f} className="flex shrink-0 items-center gap-10">
                <span className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-[0.16em] text-band-muted">
                  {f}
                </span>
                <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
