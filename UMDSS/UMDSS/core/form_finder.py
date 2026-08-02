"""Find a scholarship's real application form automatically.

Nobody should have to paste an application link by hand. Every scholarship
carries the page it was scraped from, so we read that page the way a student
would: look for a form we can open in the app, then for an "Apply" link, then
for an application email. If the listing only points at the funder's own page
(aggregators usually do), we follow one hop and look again.

Only Google Forms, Microsoft Forms and Typeform can be embedded in the app, so
those are ranked first. Anything else is still worth finding, it just opens on
the provider's site instead.

Everything here is best-effort and must never raise: a scholarship with no
discoverable form is a normal outcome, not an error.
"""
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

TIMEOUT = 8
MAX_BYTES = 1_500_000
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

# Link text that means "this is the application", strongest first.
APPLY_PHRASES = [
    'application form', 'apply now', 'apply online', 'apply here',
    'start your application', 'start application', 'submit your application',
    'begin application', 'application portal', 'online application',
    'apply for this', 'application link', 'apply',
]

# Link text that means "the real listing lives here", worth one hop.
OFFICIAL_PHRASES = [
    'official website', 'official page', 'official link', 'scholarship page',
    'visit the official', 'for more information', 'more details', 'learn more',
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
)

# Page furniture that never contains the real application link.
CHROME_TAGS = ('nav', 'aside', 'footer', 'header', 'noscript')

# Never mistake these for a funder's own website.
JUNK_HOSTS = (
    'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com',
    'youtube.com', 'youtu.be', 'pinterest.com', 'tiktok.com', 'whatsapp.com',
    'wa.me', 't.me', 'telegram.me', 'reddit.com', 'medium.com',
    'google.com', 'googleapis.com', 'gstatic.com', 'gravatar.com',
    'wordpress.com', 'wp.com', 'bit.ly', 'tinyurl.com', 'amazon.com',
    'apple.com', 'microsoft.com', 'wikipedia.org', 'blogspot.com',
)

# Where funders habitually put their application page. Tried against the
# funder's own domain only after their homepage gives us nothing.
COMMON_APPLY_PATHS = ('/apply', '/how-to-apply', '/scholarships')
PROBE_TIMEOUT = 5


def _is_junk_host(url):
    host = _host_of(url)
    return not host or any(host == h or host.endswith('.' + h) for h in JUNK_HOSTS)


def _root_of(url):
    try:
        p = urlparse(url)
        return f'{p.scheme}://{p.netloc}'
    except Exception:
        return ''


def _host_of(url):
    try:
        return (urlparse(url).hostname or '').lower().lstrip('www.')
    except Exception:
        return ''


def _is_aggregator(url):
    host = _host_of(url)
    return any(host == h or host.endswith('.' + h) for h in AGGREGATOR_HOSTS)

_BAD_HOST = re.compile(r'^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)')


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
        host = (urlparse(url).hostname or '').lower()
        path = (urlparse(url).path or '').lower()
    except Exception:
        return None
    for h, required_path in EMBEDDABLE:
        if (host == h or host.endswith('.' + h)) and (not required_path or required_path in path):
            return h
    return None


def _fetch(url):
    if not _is_safe_url(url):
        return None
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
        if r.status_code != 200:
            return None
        ctype = (r.headers.get('content-type') or '').lower()
        if 'html' not in ctype:
            return None
        content = r.raw.read(MAX_BYTES, decode_content=True)
        return BeautifulSoup(content, 'html.parser')
    except Exception:
        return None


def _scan(soup, base_url):
    """Pull everything useful out of one page.

    Returns (embeddable_url, apply_url, email, hop_candidates, offsite_roots).
    `offsite_roots` are the distinct third-party sites linked from the content,
    which is how we work out whose site the funder actually runs.
    """
    embeddable = None
    apply_url = None
    email = None
    hops = []
    offsite = []

    if soup is None:
        return embeddable, apply_url, email, hops, offsite

    # Drop menus, sidebars and footers before looking at anything: that is where
    # other scholarships' "Apply" links live.
    for tag in soup.find_all(CHROME_TAGS):
        tag.decompose()

    # On aggregator sites, only an off-site link can be the real application.
    source_is_aggregator = _is_aggregator(base_url)
    source_host = _host_of(base_url)

    # A page that embeds the form itself is the jackpot: take the iframe src.
    for frame in soup.find_all('iframe', src=True):
        src = urljoin(base_url, frame['src'].strip())
        if _embeddable_kind(src):
            return src, apply_url, email, hops, offsite

    for a in soup.find_all('a', href=True):
        raw = a['href'].strip()
        text = ' '.join(a.get_text(' ', strip=True).lower().split())

        if raw.lower().startswith('mailto:'):
            addr = raw[7:].split('?')[0].strip()
            if email is None and '@' in addr:
                email = addr
            continue

        href = urljoin(base_url, raw)
        if not _is_safe_url(href):
            continue

        if _embeddable_kind(href):
            # Best possible result, stop looking.
            return href, apply_url, email, hops, offsite

        # A same-site "Apply" on an aggregator is a link to some other listing,
        # so treat it as a hop candidate rather than this scholarship's form.
        same_site = _host_of(href) == source_host

        # Remember whose sites this page points at. When the listing yields no
        # form, the funder's own site is the next place to look.
        if not same_site and not _is_junk_host(href):
            root = _root_of(href)
            if root and root not in offsite and len(offsite) < 6:
                offsite.append(root)

        if source_is_aggregator and same_site:
            continue

        if any(p in text for p in APPLY_PHRASES):
            if apply_url is None:
                apply_url = href
        elif any(p in text for p in OFFICIAL_PHRASES) and len(hops) < 2:
            hops.append(href)

    return embeddable, apply_url, email, hops, offsite


def _probe_funder_site(root):
    """Look for an application on a funder's own domain.

    One request for the homepage, then a couple of the paths funders habitually
    use. Returns (embeddable_url, apply_url, email) with anything it found.
    """
    home = _fetch(root)
    if home is not None:
        embed, apply_url, email, _, _ = _scan(home, root)
        if embed:
            return embed, None, email
        if apply_url:
            return None, apply_url, email
    else:
        email = None

    for path in COMMON_APPLY_PATHS:
        url = root.rstrip('/') + path
        if not _is_safe_url(url):
            continue
        try:
            r = requests.get(url, headers=HEADERS, timeout=PROBE_TIMEOUT,
                             stream=True, allow_redirects=True)
            if r.status_code != 200 or 'html' not in (r.headers.get('content-type') or '').lower():
                continue
            soup = BeautifulSoup(r.raw.read(MAX_BYTES, decode_content=True), 'html.parser')
        except Exception:
            continue
        embed, apply_url, page_email, _, _ = _scan(soup, url)
        if embed:
            return embed, None, page_email or email
        # The page exists and is named /apply, so it is the application page
        # even if it holds no onward link.
        return None, (apply_url or url), page_email or email

    return None, None, email


def discover_application_form(source_url, follow=True):
    """Best-effort {'url', 'email', 'mode'} for how to apply. Never raises."""
    result = {'url': '', 'email': '', 'mode': 'unknown'}
    if not source_url:
        return result

    soup = _fetch(source_url)
    embeddable, apply_url, email, hops, offsite = _scan(soup, source_url)

    if embeddable:
        return {'url': embeddable, 'email': email or '', 'mode': 'online'}

    # The listing pointed elsewhere. Follow the most promising links once, in
    # case the real form lives on the funder's own page.
    if follow:
        for hop in ([apply_url] if apply_url else []) + hops:
            hop_soup = _fetch(hop)
            if hop_soup is None:
                continue
            hop_embed, hop_apply, hop_email, _, hop_offsite = _scan(hop_soup, hop)
            if hop_embed:
                return {'url': hop_embed, 'email': hop_email or email or '', 'mode': 'online'}
            if apply_url is None and hop_apply:
                apply_url = hop_apply
            if not email and hop_email:
                email = hop_email
            for root in hop_offsite:
                if root not in offsite:
                    offsite.append(root)

    # Still nothing usable. Most listings are aggregator write-ups that link the
    # funder without linking the form, so go to the funder's own site and look
    # there. Only worth doing when the listing gave us no application at all.
    if follow and not apply_url:
        for root in offsite[:2]:
            if _is_aggregator(root) or _host_of(root) == _host_of(source_url):
                continue
            site_embed, site_apply, site_email = _probe_funder_site(root)
            if site_embed:
                return {'url': site_embed, 'email': site_email or email or '', 'mode': 'online'}
            if site_apply:
                apply_url = site_apply
                email = email or site_email
                break
            if not email and site_email:
                email = site_email

    if apply_url:
        return {'url': apply_url, 'email': email or '', 'mode': 'online'}
    if email:
        return {'url': '', 'email': email, 'mode': 'email'}
    return result
