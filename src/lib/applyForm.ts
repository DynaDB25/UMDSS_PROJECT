// Work out how a student can actually apply to a given scholarship, and where
// possible bring the provider's own form into the app.
//
// Google Forms, Microsoft Forms and Typeform all publish supported embed URLs,
// and a very large share of African scholarship programmes run on them. When we
// detect one we render it inline: the student fills and submits the provider's
// real form, hosted by the provider, without leaving ScholarCircle. We never
// submit for them, so there is no credential handling and no impersonation.
//
// Anything else (bespoke portals, PDF downloads, email applications) cannot be
// embedded, either because the host sends X-Frame-Options/frame-ancestors or
// because there is no web form at all. Those fall back to a deep link or a
// prepared email, which is the honest ceiling for them.

export type FormKind = 'google' | 'microsoft' | 'typeform' | 'external' | 'email' | 'none'

export interface ApplyRoute {
  kind: FormKind
  /** Set only when the form can legitimately be embedded. */
  embedUrl?: string
  /** Where "open in a new tab" should go. */
  externalUrl?: string
  email?: string
  /** Short human explanation of how this application works. */
  label: string
}

function withParam(url: string, key: string, value: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set(key, value)
    return u.toString()
  } catch {
    return url + (url.includes('?') ? '&' : '?') + `${key}=${value}`
  }
}

export function classifyApplyRoute(
  applicationUrl?: string,
  sourceUrl?: string,
  applicationEmail?: string,
): ApplyRoute {
  const url = (applicationUrl || '').trim()
  const email = (applicationEmail || '').trim()
  const fallback = (sourceUrl || '').trim()

  if (url) {
    let host = ''
    try {
      host = new URL(url).hostname.toLowerCase()
    } catch {
      host = ''
    }
    const path = url.toLowerCase()

    // Google Forms: /viewform is the responder view; embedded=true is Google's
    // own documented embed parameter.
    if (host.endsWith('docs.google.com') && path.includes('/forms/')) {
      const base = url.split('?')[0].replace(/\/(edit|viewform)?$/, '/viewform')
      return {
        kind: 'google',
        embedUrl: withParam(base, 'embedded', 'true'),
        externalUrl: url,
        label: 'Google Form, fill it in right here',
      }
    }

    if (host.endsWith('forms.office.com') || host.endsWith('forms.microsoft.com')) {
      return {
        kind: 'microsoft',
        embedUrl: withParam(url, 'embed', 'true'),
        externalUrl: url,
        label: 'Microsoft Form, fill it in right here',
      }
    }

    if (host.endsWith('typeform.com')) {
      return {
        kind: 'typeform',
        embedUrl: url,
        externalUrl: url,
        label: 'Typeform, fill it in right here',
      }
    }

    return {
      kind: 'external',
      externalUrl: url,
      email: email || undefined,
      label: "The provider runs its own portal, so this opens on their site",
    }
  }

  if (email) {
    return { kind: 'email', email, label: 'This funder accepts applications by email' }
  }

  if (fallback) {
    return {
      kind: 'external',
      externalUrl: fallback,
      label: 'No direct form published, this opens the original listing',
    }
  }

  return { kind: 'none', label: 'The provider has not published an application link yet' }
}
