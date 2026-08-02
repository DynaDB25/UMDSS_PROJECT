import { cn } from '../lib/cn'

// Public logo URLs from Wikimedia Commons and official sources
export const LOGO_URLS: Record<string, string> = {
  'sch-getfund':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Coat_of_arms_of_Ghana.svg/150px-Coat_of_arms_of_Ghana.svg.png',
  'sch-mtn':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/New-mtn-logo.svg/220px-New-mtn-logo.svg.png',
  'sch-mastercard':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/MasterCard_Logo.svg/200px-MasterCard_Logo.svg.png',
  'sch-district':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Coat_of_arms_of_Ghana.svg/150px-Coat_of_arms_of_Ghana.svg.png',
  'sch-stanbic':
    'https://upload.wikimedia.org/wikipedia/en/thumb/8/86/Standard_Bank_logo.svg/200px-Standard_Bank_logo.svg.png',
  'sch-chevening':
    'https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Royal_Coat_of_Arms_of_the_United_Kingdom_%28HM_Government%29.svg/150px-Royal_Coat_of_Arms_of_the_United_Kingdom_%28HM_Government%29.svg.png',
}

export function ScholarshipLogo({
  scholarshipId,
  initials,
  color,
  className,
}: {
  scholarshipId: string
  initials: string
  color: string
  className?: string
}) {
  const url = LOGO_URLS[scholarshipId]

  if (url) {
    return (
      <div
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-ink-200/60',
          className,
        )}
      >
        <img
          src={url}
          alt={initials}
          className="h-[70%] w-[70%] object-contain"
          loading="lazy"
          onError={(e) => {
            // fallback to initials on load failure
            const parent = (e.target as HTMLImageElement).parentElement
            if (parent) {
              parent.classList.remove('bg-white', 'ring-1', 'ring-ink-200/60')
              parent.classList.add(color)
              parent.innerHTML = `<span class="font-semibold text-white">${initials}</span>`
            }
          }}
        />
      </div>
    )
  }

  // Fallback: colored circle with initials
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
