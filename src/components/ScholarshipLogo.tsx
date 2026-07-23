import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'

// Map a scholarship's funder (matched in its name/provider) to an official
// domain. We look the logo up from that domain at render time, so we don't have
// to hand-maintain an image URL per scholarship — any new scraped award whose
// funder is in this list automatically gets a real logo.
const FUNDER_DOMAINS: [RegExp, string][] = [
  [/chevening/i, 'chevening.org'],
  [/\bdaad\b|german academic/i, 'daad.de'],
  [/mastercard/i, 'mastercardfdn.org'],
  [/commonwealth/i, 'cscuk.fcdo.gov.uk'],
  [/world ?bank|wbgsp/i, 'worldbank.org'],
  [/african union/i, 'au.int'],
  [/getfund|ghana education trust/i, 'getfund.gov.gh'],
  [/scholarship secretariat|district[- ]level|registrar[- ]general/i, 'scholarships.gov.gh'],
  [/\bmtn\b/i, 'mtn.com'],
  [/knust|kwame nkrumah/i, 'knust.edu.gh'],
  [/university of ghana|legon/i, 'ug.edu.gh'],
  [/stanbic/i, 'stanbicbank.com.gh'],
  [/\brhodes\b/i, 'rhodeshouse.ox.ac.uk'],
  [/mandela rhodes/i, 'mandelarhodes.org'],
  [/unesco/i, 'unesco.org'],
  [/unhcr|\bdafi\b/i, 'unhcr.org'],
  [/unicef/i, 'unicef.org'],
  [/\bundp\b/i, 'undp.org'],
  [/fulbright/i, 'fulbrightprogram.org'],
  [/gates cambridge/i, 'gatescambridge.org'],
  [/schwarzman/i, 'schwarzmanscholars.org'],
  [/rotary/i, 'rotary.org'],
  [/unicaf/i, 'unicaf.org'],
  [/erasmus/i, 'erasmus-plus.ec.europa.eu'],
  [/canon collins/i, 'canoncollins.org.uk'],
  [/\bacu\b|association of commonwealth universities/i, 'acu.ac.uk'],
  [/royal society/i, 'royalsociety.org'],
  [/british council/i, 'britishcouncil.org'],
  [/mcgill/i, 'mcgill.ca'],
  [/oxford/i, 'ox.ac.uk'],
  [/cambridge/i, 'cam.ac.uk'],
  [/harvard/i, 'harvard.edu'],
  [/\bmit\b/i, 'mit.edu'],
  [/stanford/i, 'stanford.edu'],
  [/google/i, 'google.org'],
  [/microsoft/i, 'microsoft.com'],
  [/\bope?n society|osf\b/i, 'opensocietyfoundations.org'],
]

function funderDomain(name?: string, provider?: string): string | null {
  const hay = `${name || ''} ${provider || ''}`
  for (const [re, domain] of FUNDER_DOMAINS) {
    if (re.test(hay)) return domain
  }
  return null
}

// Ordered logo providers to try for a domain. Both return the site's real
// brand mark as a PNG; DuckDuckGo is the fallback if Google's has no result.
function logoSources(domain: string): string[] {
  return [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ]
}

export function ScholarshipLogo({
  name,
  provider,
  initials,
  color,
  className,
}: {
  name?: string
  provider?: string
  initials: string
  color: string
  className?: string
}) {
  const sources = useMemo(() => {
    const domain = funderDomain(name, provider)
    return domain ? logoSources(domain) : []
  }, [name, provider])

  const [idx, setIdx] = useState(0)
  const exhausted = idx >= sources.length

  if (!exhausted) {
    return (
      <div
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-ink-200/60',
          className,
        )}
      >
        <img
          src={sources[idx]}
          alt={name || initials}
          className="h-[70%] w-[70%] object-contain"
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      </div>
    )
  }

  // Fallback: colored tile with initials
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-xl font-semibold text-white',
        color,
        className,
      )}
    >
      {initials}
    </div>
  )
}
