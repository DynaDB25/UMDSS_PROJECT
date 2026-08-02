"""Find a scholarship's real application form automatically.

Nobody should have to paste an application link by hand. This module reads the
web the way a determined student would and returns a *ranked* set of candidates
rather than a single guess, so that even when we cannot be certain the app can
offer real places to click instead of an empty box.

The pipeline, in order of confidence:

  1. A form platform embedded in, or linked from, the listing page. Google
     Forms, Microsoft Forms, Typeform and friends are unambiguous.
  2. A known scholarship portal (SMApply, Submittable, AwardForce, Embark,
     scholarships.gov.gh and so on). Those hosts exist only to take applications.
  3. Apply links on the listing, judged on both their wording and their URL.
  4. One hop through "official website" style links, then the same checks again.
  5. The funder's own domain, probed on the paths funders habitually use.
  6. A web search, which is what a student would actually do, restricted to the
     funder's domain where we know it.

Application PDFs count. A downloadable form is how a large share of Ghanaian
district and government schemes actually work, and pretending otherwise is how
you end up with nothing to show.

Everything here is best effort and must never raise: a scholarship with no
discoverable form is a normal outcome, not an error.
"""
import ipaddress
import re
import socket
import time
from urllib.parse import urljoin, urlparse, quote_plus, parse_qs, unquote

import requests
from bs4 import BeautifulSoup

TIMEOUT = 8
PROBE_TIMEOUT = 5
MAX_BYTES = 1_500_000

# Whole-discovery budget. The view runs this in the background, but a scrape
# that never ends still ties up a worker.
BUDGET_SECONDS = 30

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (compatible; ScholarCircleBot/1.0; +https://scholarcircle.vercel.app) '
        'application-form-finder'
    )
}

# Hosts whose forms we can render inside the app.
EMBEDDABLE = (
    ('docs.google.com', '/forms'),
    ('forms.office.com', ''),
    ('forms.microsoft.com', ''),
    ('form.typeform.com', ''),
    ('typeform.com', ''),
)

# Form builders and application portals. Landing on one of these is about as
# close to certainty as this gets: nobody links them by accident.
FORM_HOSTS = (
    'docs.google.com', 'forms.gle', 'forms.office.com', 'forms.microsoft.com',
    'typeform.com', 'jotform.com', 'form.jotform.com', 'cognitoforms.com',
    'zohopublic.com', 'forms.zohopublic.com', 'airtable.com', 'wufoo.com',
    'formstack.com', 'surveymonkey.com', 'qualtrics.com', 'smartsurvey.co.uk',
    'formsite.com', 'gravityforms.com', 'tally.so', 'fillout.com',
)

APPLICATION_PORTAL_HOSTS = (
    'smapply.io', 'smapply.org', 'submittable.com', 'awardforce.com',
    'goodgrants.com', 'embark.com', 'fluidreview.com', 'survey.alchemer.com',
    'scholarships.gov.gh', 'getfund.gov.gh', 'apply.mastercardfdn.org',
    'scholarshipportal.com', 'applyweb.com', 'commonapp.org',
)

# Link text that means "this is the application", strongest first.
APPLY_PHRASES = [
    'application form', 'apply now', 'apply online', 'apply here',
    'start your application', 'start application', 'submit your application',
    'begin application', 'application portal', 'online application',
    'download the application', 'application link', 'apply for this', 'apply',
]

# URL path tokens that mean the same thing.
APPLY_PATH_TOKENS = (
    'apply', 'application', 'applications', 'application-form', 'applyonline',
    'register', 'registration', 'admission', 'admissions', 'portal', 'form',
    'submit', 'intake', 'enrol', 'enroll',
)

# Paths that look like an application but are really site furniture.
NEGATIVE_PATH_TOKENS = (
    '/category/', '/tag/', '/author/', '/page/', '/blog/', '/news/',
    '/privacy', '/terms', '/cookie', '/about', '/contact-us', '/login',
    '/wp-admin', '/feed', '/search', '/faq',
)

# Link text that means "the real listing lives here", worth one hop.
OFFICIAL_PHRASES = [
    'official website', 'official page', 'official link', 'scholarship page',
    'visit the official', 'for more information', 'more details', 'learn more',
    'official announcement', 'read more on',
]

# Sites that republish other people's scholarships. Their pages are thick with
# "Apply" links belonging to *other* listings (related posts, promo rails), so
# on these hosts an apply link that stays on the same site is page furniture,
# not this scholarship's form. Sending a student to the wrong scholarship is
# worse than finding nothing, so we only trust off-site links here.
AGGREGATOR_HOSTS = (
    'afterschoolafrica.com', 'opportunitydesk.org', 'opportunitiesforafricans.com',
    'scholars4dev.com', 'scholarshipregion.com', 'msmeafricaonline.com',
    'globalsouthopportunities.com', 'advance-africa.com', 'scholarshipset.com',
    'scholarshiproar.com', 'scholarshiptab.com', 'youthop.com', 'opportunitycorners.info',
)

# Page furniture that never contains the real application link.
CHROME_TAGS = ('nav', 'aside', 'footer', 'header', 'noscript')

# Never mistake these for a funder's own website. Beyond the obvious social
# networks this covers the hosts that sit on a funder's page for reasons that
# have nothing to do with applying: video embeds, donation widgets, mailing
# lists, payment and scheduling. Left unlisted they score as "apply" pages
# because their URLs happen to contain words like "form" or "submit".
JUNK_HOSTS = (
    'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com',
    'youtube.com', 'youtu.be', 'pinterest.com', 'tiktok.com', 'whatsapp.com',
    'wa.me', 't.me', 'telegram.me', 'reddit.com', 'medium.com', 'threads.net',
    'google.com', 'googleapis.com', 'gstatic.com', 'gravatar.com',
    'wordpress.com', 'wp.com', 'bit.ly', 'tinyurl.com', 'amazon.com',
    'apple.com', 'wikipedia.org', 'blogspot.com', 'duckduckgo.com',
    # media and embeds
    'vimeo.com', 'player.vimeo.com', 'soundcloud.com', 'spotify.com',
    'issuu.com', 'canva.com', 'flickr.com', 'imgur.com', 'giphy.com',
    # money, mailing lists and scheduling
    'zeffy.com', 'paypal.com', 'gofundme.com', 'donorbox.org', 'givebutter.com',
    'stripe.com', 'patreon.com', 'mailchimp.com', 'us1.list-manage.com',
    'list-manage.com', 'substack.com', 'calendly.com', 'eventbrite.com',
    'linktr.ee', 'sendgrid.net',
)

# Words that carry no identity, so they never prove a host belongs to a funder.
_GENERIC_TOKENS = {
    'the', 'and', 'for', 'of', 'in', 'at', 'to', 'a', 'an',
    'foundation', 'fund', 'trust', 'scholarship', 'scholarships', 'scholars',
    'programme', 'program', 'award', 'awards', 'bursary', 'grant', 'grants',
    'university', 'college', 'school', 'institute', 'international', 'global',
    'africa', 'african', 'ghana', 'ghanaian', 'west', 'national', 'group',
    'limited', 'ltd', 'plc', 'company', 'org', 'initiative', 'project',
    'education', 'educational', 'youth', 'students', 'student', 'fully',
    'funded', 'apply', 'application', 'online', 'free', 'new', 'centre',
    'center', 'council', 'ministry', 'association', 'society', 'network',
}

# Where funders habitually put their application page.
COMMON_APPLY_PATHS = (
    '/apply', '/how-to-apply', '/application', '/scholarships', '/scholarship',
    '/opportunities', '/apply-now',
)

_BAD_HOST = re.compile(r'^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)')
_EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')


# ── helpers ───────────────────────────────────────────────────────────

def _root_of(url):
    try:
        p = urlparse(url)
        return f'{p.scheme}://{p.netloc}'
    except Exception:
        return ''


def _host_of(url):
    try:
        host = (urlparse(url).hostname or '').lower()
        return host[4:] if host.startswith('www.') else host
    except Exception:
        return ''


def _host_in(url, hosts):
    host = _host_of(url)
    return bool(host) and any(host == h or host.endswith('.' + h) for h in hosts)


def _is_junk_host(url):
    return not _host_of(url) or _host_in(url, JUNK_HOSTS)


def _is_aggregator(url):
    return _host_in(url, AGGREGATOR_HOSTS)


def _is_safe_url(url):
    """Only public http(s). Blocks loopback/private targets so a poisoned
    source_url cannot turn this into an internal port scanner."""
    try:
        p = urlparse(url)
        if p.scheme not in ('http', 'https') or not p.hostname:
            return False
        host = p.hostname.lower()
        if _BAD_HOST.match(host) or host.endswith('.local'):
            return False
        try:
            ip = ipaddress.ip_address(socket.gethostbyname(host))
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except (socket.gaierror, ValueError):
            pass  # unresolvable is fine, the request will simply fail
        return True
    except Exception:
        return False


def _embeddable_kind(url):
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or '').lower()
        path = (parsed.path or '').lower()
    except Exception:
        return None
    for h, required_path in EMBEDDABLE:
        if (host == h or host.endswith('.' + h)) and (not required_path or required_path in path):
            return h
    return None


def _is_pdf(url):
    return urlparse(url).path.lower().endswith(('.pdf', '.doc', '.docx'))


def _fetch(url, timeout=TIMEOUT):
    if not _is_safe_url(url):
        return None
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, stream=True, allow_redirects=True)
        if r.status_code != 200:
            return None
        ctype = (r.headers.get('content-type') or '').lower()
        if 'html' not in ctype:
            return None
        content = r.raw.read(MAX_BYTES, decode_content=True)
        return BeautifulSoup(content, 'html.parser')
    except Exception:
        return None


# ── scoring ───────────────────────────────────────────────────────────

class Candidate:
    """One possible place to apply, with why we think so."""

    __slots__ = ('url', 'score', 'reason', 'kind')

    def __init__(self, url, score, reason, kind):
        self.url = url
        self.score = score
        self.reason = reason
        self.kind = kind

    def as_dict(self):
        return {
            'url': self.url,
            'score': max(0, min(100, int(self.score))),
            'reason': self.reason,
            'kind': self.kind,
            'host': _host_of(self.url),
            'embeddable': bool(_embeddable_kind(self.url)),
        }


def _score_link(url, text, source_url, funder_hosts):
    """Rate one link as a possible application. Returns (score, reason, kind)
    or None when it is clearly not one."""
    if not url or _is_junk_host(url):
        return None

    path = (urlparse(url).path or '').lower()
    text = (text or '').lower()

    if any(bad in path for bad in NEGATIVE_PATH_TOKENS):
        return None

    if _embeddable_kind(url):
        return 100, 'An online form we can open inside ScholarCircle', 'form'
    if _host_in(url, FORM_HOSTS):
        return 94, 'A hosted application form', 'form'
    if _host_in(url, APPLICATION_PORTAL_HOSTS):
        return 90, 'A scholarship application portal', 'portal'

    score = 0
    reasons = []
    host = _host_of(url)

    # A dedicated apply.* subdomain exists for exactly one purpose.
    if host.startswith(('apply.', 'application.', 'applications.', 'portal.', 'admissions.')):
        score += 45
        reasons.append('the funder runs this subdomain purely for applications')

    # What the link calls itself.
    for i, phrase in enumerate(APPLY_PHRASES):
        if phrase in text:
            score += 55 - i * 2
            reasons.append(f'the link says "{phrase}"')
            break

    # What the address says.
    segments = [s for s in path.split('/') if s]
    if any(tok in segments for tok in APPLY_PATH_TOKENS):
        score += 25
        reasons.append('the address points at an application page')
    elif any(tok in path for tok in APPLY_PATH_TOKENS):
        score += 15
        reasons.append('the address mentions applying')

    if _is_pdf(url):
        if score == 0:
            return None
        score += 10
        reasons.append('it is a downloadable form')
        kind = 'document'
    else:
        kind = 'page'

    # A link that leaves an aggregator is far more likely to be the real thing.
    if _is_aggregator(source_url) and _host_of(url) != _host_of(source_url):
        score += 12
        reasons.append('it leaves the listing site')

    # Anything on the funder's own domain outranks a third party.
    if funder_hosts and host in funder_hosts:
        score += 15
        reasons.append("it is on the funder's own site")

    if _is_aggregator(url):
        score -= 30

    if score < 20:
        return None

    reason = reasons[0][0].upper() + reasons[0][1:] if reasons else 'Looks like an application page'
    if len(reasons) > 1:
        reason += ', and ' + reasons[1]
    return score, reason, kind


# ── page scanning ─────────────────────────────────────────────────────

def _scan(soup, base_url, funder_hosts):
    """Pull everything useful out of one page.

    Returns (candidates, email, hops, offsite_roots). `offsite_roots` are the
    distinct third-party sites linked from the content, which is how we work
    out whose site the funder actually runs.
    """
    candidates = []
    email = None
    hops = []
    offsite = []

    if soup is None:
        return candidates, email, hops, offsite

    # Drop menus, sidebars and footers before looking at anything: that is where
    # other scholarships' "Apply" links live.
    for tag in soup.find_all(CHROME_TAGS):
        tag.decompose()

    source_is_aggregator = _is_aggregator(base_url)
    source_host = _host_of(base_url)

    # A page that embeds the form itself is the jackpot.
    for frame in soup.find_all('iframe', src=True):
        src = urljoin(base_url, frame['src'].strip())
        if _embeddable_kind(src):
            candidates.append(
                Candidate(src, 100, 'The application form is embedded on this page', 'form')
            )

    # A bare <form> that posts somewhere on the same site is often the real
    # application, especially on funder-built sites.
    for form in soup.find_all('form', action=True):
        action = urljoin(base_url, form['action'].strip())
        blob = ' '.join(form.get_text(' ', strip=True).lower().split())[:400]
        if any(p in blob for p in ('apply', 'application', 'scholarship')) and _is_safe_url(action):
            if len(form.find_all(['input', 'select', 'textarea'])) >= 4:
                candidates.append(
                    Candidate(base_url, 88, 'This page hosts the application form itself', 'form')
                )
                break

    text_emails = []
    for a in soup.find_all('a', href=True):
        raw = a['href'].strip()
        text = ' '.join(a.get_text(' ', strip=True).lower().split())

        if raw.lower().startswith('mailto:'):
            addr = raw[7:].split('?')[0].strip()
            if '@' in addr and email is None:
                email = addr
            continue

        href = urljoin(base_url, raw)
        if not _is_safe_url(href):
            continue

        same_site = _host_of(href) == source_host

        # Remember whose sites this page points at.
        if not same_site and not _is_junk_host(href):
            root = _root_of(href)
            if root and root not in offsite and len(offsite) < 8:
                offsite.append(root)

        # A same-site "Apply" on an aggregator is a link to some other listing.
        if source_is_aggregator and same_site:
            if any(p in text for p in OFFICIAL_PHRASES) and len(hops) < 3:
                hops.append(href)
            continue

        scored = _score_link(href, text, base_url, funder_hosts)
        if scored:
            candidates.append(Candidate(href, scored[0], scored[1], scored[2]))
        elif any(p in text for p in OFFICIAL_PHRASES) and len(hops) < 3:
            hops.append(href)

    # Emails written as plain text near application language.
    body = soup.get_text(' ', strip=True)
    if email is None:
        window = body.lower()
        for m in _EMAIL_RE.finditer(body):
            addr = m.group(0)
            around = window[max(0, m.start() - 160):m.end() + 160]
            if any(w in around for w in ('apply', 'application', 'submit', 'send')):
                text_emails.append(addr)
        if text_emails:
            email = text_emails[0]

    return candidates, email, hops, offsite


def _identity_tokens(*parts):
    """Distinctive words from a funder's name, used to tell their own domain
    apart from every other host that happens to sit on the same page."""
    tokens = set()
    for part in parts:
        for raw in re.split(r'[^a-z0-9]+', (part or '').lower()):
            if len(raw) >= 4 and raw not in _GENERIC_TOKENS:
                tokens.add(raw)
    return tokens


def _looks_like_funder(host, tokens):
    """True when a host plausibly belongs to the funder rather than to a video
    embed, a donation widget or an unrelated partner."""
    if not host or not tokens:
        return False
    flat = host.replace('-', '').replace('.', '')
    return any(t in flat for t in tokens)


def _is_soft_404(soup):
    """Many sites answer 200 for everything. Treat an obvious error page, or a
    page with almost no content, as a miss."""
    if soup is None:
        return True
    text = ' '.join(soup.get_text(' ', strip=True).lower().split())
    if len(text) < 200:
        return True
    head = text[:400]
    return any(
        p in head
        for p in ('page not found', 'not found', '404', 'no longer available', "doesn't exist")
    )


def _probe_funder_site(root, funder_hosts, deadline, tokens):
    """Look for an application on a funder's own domain."""
    found = []
    email = None

    home = _fetch(root)
    if home is not None:
        cands, email, _, _ = _scan(home, root, funder_hosts)
        found.extend(cands)

    for path in COMMON_APPLY_PATHS:
        if time.monotonic() > deadline:
            break
        url = root.rstrip('/') + path
        if not _is_safe_url(url):
            continue
        try:
            r = requests.get(url, headers=HEADERS, timeout=PROBE_TIMEOUT,
                             stream=True, allow_redirects=True)
            if r.status_code != 200:
                continue
            if 'html' not in (r.headers.get('content-type') or '').lower():
                continue
            soup = BeautifulSoup(r.raw.read(MAX_BYTES, decode_content=True), 'html.parser')
        except Exception:
            continue

        # A 200 proves nothing on its own, so require the page to actually read
        # like an application page before offering it to a student.
        if _is_soft_404(soup):
            continue

        cands, page_email, _, _ = _scan(soup, url, funder_hosts)
        found.extend(cands)
        email = email or page_email

        body = ' '.join(soup.get_text(' ', strip=True).lower().split())[:4000]
        if ('apply' in body or 'application' in body) and 'scholarship' in body:
            found.append(
                Candidate(url, 66, "The funder's own application page", 'page')
            )
            break

    return found, email


# ── web search ────────────────────────────────────────────────────────

def _ddg_search(query, limit=6):
    """Search results without an API key. Returns a list of result URLs."""
    urls = []
    try:
        r = requests.post(
            'https://html.duckduckgo.com/html/',
            data={'q': query},
            headers=HEADERS,
            timeout=PROBE_TIMEOUT,
        )
        if r.status_code != 200:
            return urls
        soup = BeautifulSoup(r.text[:MAX_BYTES], 'html.parser')
        for a in soup.select('a.result__a, a.result__url'):
            href = a.get('href') or ''
            # DuckDuckGo wraps results in a redirect carrying the real target.
            if '/l/?' in href or 'uddg=' in href:
                qs = parse_qs(urlparse(href).query)
                target = (qs.get('uddg') or [''])[0]
                href = unquote(target) if target else ''
            if href.startswith('http') and href not in urls and not _is_junk_host(href):
                urls.append(href)
            if len(urls) >= limit:
                break
    except Exception:
        pass
    return urls


def _search_candidates(name, provider, funder_hosts, deadline):
    """What a student would type into a search box, done for them."""
    found = []
    if not name:
        return found

    queries = [f'"{name}" application form apply']
    primary = next(iter(funder_hosts), '') if funder_hosts else ''
    if primary:
        queries.insert(0, f'site:{primary} {name} apply')
    elif provider:
        queries.append(f'{provider} {name} official application')

    for q in queries:
        if time.monotonic() > deadline:
            break
        for url in _ddg_search(quote_plus(q) and q):
            scored = _score_link(url, url, '', funder_hosts)
            if scored:
                # Search results are a weaker signal than a link on the funder's
                # own page, so they never outrank a direct discovery.
                found.append(
                    Candidate(url, min(scored[0], 78) - 8, 'Found by searching the web', scored[2])
                )
        if found:
            break
    return found


# ── entry point ───────────────────────────────────────────────────────

def _dedupe(candidates):
    best = {}
    for c in candidates:
        key = c.url.rstrip('/')
        if key not in best or c.score > best[key].score:
            best[key] = c
    return sorted(best.values(), key=lambda c: -c.score)


def discover_application_form(source_url, follow=True, name='', provider='', deep=True):
    """Best effort description of how to apply. Never raises.

    Returns {'url', 'email', 'mode', 'candidates'} where `candidates` is a
    ranked list of dicts, so callers can offer real choices when no single
    result is confident enough to auto-select.
    """
    deadline = time.monotonic() + BUDGET_SECONDS
    result = {'url': '', 'email': '', 'mode': 'unknown', 'candidates': []}
    if not source_url:
        return result

    tokens = _identity_tokens(provider, name)
    funder_hosts = set()
    all_candidates = []

    soup = _fetch(source_url)
    candidates, email, hops, offsite = _scan(soup, source_url, funder_hosts)
    all_candidates.extend(candidates)

    # Work out whose site the funder runs, so later scoring can prefer it. Only
    # hosts that actually carry the funder's name count: a page links plenty of
    # third parties, and treating any of them as "the funder" is how a student
    # ends up pointed at a video host.
    for root in offsite:
        host = _host_of(root)
        if _is_aggregator(root) or host == _host_of(source_url):
            continue
        if _looks_like_funder(host, tokens):
            funder_hosts.add(host)
    if not _is_aggregator(source_url):
        funder_hosts.add(_host_of(source_url))

    def confident():
        return any(c.score >= 90 for c in all_candidates)

    # Follow the most promising links once, in case the form lives one hop away.
    if follow and not confident():
        for hop in hops[:2]:
            if time.monotonic() > deadline:
                break
            hop_soup = _fetch(hop)
            if hop_soup is None:
                continue
            hop_c, hop_email, _, hop_offsite = _scan(hop_soup, hop, funder_hosts)
            all_candidates.extend(hop_c)
            email = email or hop_email
            for root in hop_offsite:
                if root not in offsite:
                    offsite.append(root)
            if confident():
                break

    # Most listings are write-ups that link the funder without linking the form,
    # so go to the funder's own site and look there.
    if deep and not confident() and time.monotonic() < deadline:
        # Only probe hosts that carry the funder's name, so we never crawl a
        # payment widget or a partner site looking for their application form.
        probes = [r for r in offsite if _host_of(r) in funder_hosts]
        if not probes and not _is_aggregator(source_url):
            probes = [_root_of(source_url)]
        for root in probes[:2]:
            if time.monotonic() > deadline:
                break
            site_c, site_email = _probe_funder_site(root, funder_hosts, deadline, tokens)
            all_candidates.extend(site_c)
            email = email or site_email
            if confident():
                break

    # Last resort: do the search the student would have done.
    if deep and not all_candidates and time.monotonic() < deadline:
        all_candidates.extend(_search_candidates(name, provider, funder_hosts, deadline))

    ranked = _dedupe(all_candidates)
    result['candidates'] = [c.as_dict() for c in ranked[:5]]
    result['email'] = email or ''

    # Only auto-select when we are actually confident. A weak guess presented as
    # fact is worse than showing the student the shortlist.
    if ranked and ranked[0].score >= 70:
        result['url'] = ranked[0].url
        result['mode'] = 'online'
    elif email:
        result['mode'] = 'email'

    return result
