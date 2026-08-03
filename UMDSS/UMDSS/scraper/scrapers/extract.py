"""Detail-page extraction: mine a scholarship page's full text for real data.

The listing-page scrapers only see headlines, which is why most rows used to
land with no amount, no deadline and no eligibility. Every function here reads
the *detail* page (or any blob of page text) and returns only what the page
actually states — a field that cannot be found is simply absent, never
invented. The matching engine treats absent criteria honestly (Partial cap),
so returning nothing is always safer than guessing.

All finders are pure text/soup functions so they can be unit-tested without
network access.
"""
import datetime
import logging
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# ── Dates ─────────────────────────────────────────────

MONTHS = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5,
    'june': 6, 'july': 7, 'august': 8, 'september': 9, 'october': 10,
    'november': 11, 'december': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7,
    'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}

MONTH_RE = (
    r'january|february|march|april|may|june|july|august|september|'
    r'october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec'
)

# Words that mark a date as an application deadline rather than an event date.
DEADLINE_CONTEXT_RE = re.compile(
    r'deadline|closing date|closes?\s+on|applications?\s+(?:close|end|due)|'
    r'apply\s+(?:by|before)|due\s+(?:date|by|on)|submission|'
    r'not\s+later\s+than|on\s+or\s+before|last\s+(?:day|date)',
    re.I,
)

# How far after a deadline keyword a date may sit and still be "its" date.
_DEADLINE_WINDOW = 180


def _iter_dates(text):
    """Yield (position, date) for every recognisable date in the text."""
    # ISO: 2026-08-15
    for m in re.finditer(r'(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])', text):
        try:
            yield m.start(), datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    # Day-first numeric (Ghanaian convention): 15/08/2026 or 15-08-2026
    for m in re.finditer(r'\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](20\d{2})\b', text):
        try:
            yield m.start(), datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass

    # 15th August 2026 / 15 Aug, 2026
    for m in re.finditer(
        rf'\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({MONTH_RE})[,.]?\s+(20\d{{2}})',
        text, re.I,
    ):
        month = MONTHS.get(m.group(2).lower())
        if month:
            try:
                yield m.start(), datetime.date(int(m.group(3)), month, int(m.group(1)))
            except ValueError:
                pass

    # August 15th, 2026
    for m in re.finditer(
        rf'\b({MONTH_RE})\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(20\d{{2}})',
        text, re.I,
    ):
        month = MONTHS.get(m.group(1).lower())
        if month:
            try:
                yield m.start(), datetime.date(int(m.group(3)), month, int(m.group(2)))
            except ValueError:
                pass


def _month_end(year, month):
    if month == 12:
        return datetime.date(year, 12, 31)
    return datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)


def find_deadline(text):
    """The application deadline stated in the text, or None.

    Prefers a date that follows a deadline keyword; falls back to the first
    future date on the page. A page with no dates yields None — the caller
    must NOT substitute a made-up "today + N days" value, that is exactly the
    fabrication this module exists to remove.
    """
    if not text:
        return None
    today = datetime.date.today()
    sane = lambda d: today - datetime.timedelta(days=400) <= d <= today + datetime.timedelta(days=1200)
    dates = [(pos, d) for pos, d in _iter_dates(text) if sane(d)]

    keyword_spans = [m.end() for m in DEADLINE_CONTEXT_RE.finditer(text)]
    near_keyword = [
        (pos, d) for pos, d in dates
        if any(0 <= pos - k <= _DEADLINE_WINDOW for k in keyword_spans)
    ]
    if near_keyword:
        # The date closest to its keyword is the stated deadline.
        return min(
            near_keyword,
            key=lambda pd: min(pd[0] - k for k in keyword_spans if 0 <= pd[0] - k <= _DEADLINE_WINDOW),
        )[1]

    # "Deadline: October 2026" with no day — read as end of that month.
    for k in keyword_spans:
        window = text[k:k + _DEADLINE_WINDOW]
        m = re.search(rf'\b({MONTH_RE})[,.]?\s+(20\d{{2}})', window, re.I)
        if m:
            month = MONTHS.get(m.group(1).lower())
            if month:
                d = _month_end(int(m.group(2)), month)
                if sane(d):
                    return d

    future = [d for _, d in dates if d >= today]
    if future:
        return min(future)
    return None


# ── Amounts ───────────────────────────────────────────

_CURRENCY_PATTERNS = [
    # (regex, label, is_ghs)
    (r'(?:GH₵|GH¢|GHS|GHC)\s*([\d,]+(?:\.\d{1,2})?)', 'GH₵', True),
    (r'(?:USD|US\$)\s*([\d,]+(?:\.\d{1,2})?)', 'USD', False),
    (r'\$\s*([\d,]+(?:\.\d{1,2})?)', 'USD', False),
    (r'(?:EUR|€)\s*([\d,]+(?:\.\d{1,2})?)', 'EUR', False),
    (r'(?:GBP|£)\s*([\d,]+(?:\.\d{1,2})?)', 'GBP', False),
]

_MONTHLY_RE = re.compile(r'per\s+month|/\s*month|monthly|a\s+month', re.I)
_FULL_FUNDING_RE = re.compile(
    r'full(?:y)?[- ]funded|full\s+funding|full\s+scholarship|'
    r'full\s+tuition|covers?\s+(?:full|all)\s+(?:tuition|costs?|fees)|'
    r'comprehensive\s+(?:scholarship|package|award)',
    re.I,
)


def find_amount(text):
    """(amount_str, amount_value_ghs) from the page, or None.

    amount_value is only set for GHS figures — converting foreign currency
    would mean inventing an exchange rate. Monthly stipends are annualised.
    """
    if not text:
        return None
    best = None
    for pattern, label, is_ghs in _CURRENCY_PATTERNS:
        for m in re.finditer(pattern, text):
            try:
                value = float(m.group(1).replace(',', ''))
            except ValueError:
                continue
            if value < 50:  # application fees, page numbers, etc.
                continue
            tail = text[m.end():m.end() + 30]
            monthly = bool(_MONTHLY_RE.search(tail))
            annual = value * 12 if monthly else value
            display = f"{label} {m.group(1)}" + (' / month' if monthly else '')
            candidate = (annual, display, int(annual) if is_ghs else 0)
            # Keep the largest figure: pages quote several numbers and the
            # award total is normally the biggest one.
            if best is None or candidate[0] > best[0]:
                best = candidate
    if best:
        return best[1], best[2]
    if _FULL_FUNDING_RE.search(text):
        return 'Full funding', 0
    return None


# ── Level scope ───────────────────────────────────────

_PG_RE = re.compile(
    r"master'?s|\bmsc\b|\bmphil\b|\bmba\b|\bphd\b|doctoral|doctorate|"
    r'post[- ]?graduate|graduate\s+(?:degree|studies|programme|program|study)',
    re.I,
)
_ENTRY_RE = re.compile(
    r'shs\s+graduates?|wassce\s+(?:holders?|graduates?|candidates?)|'
    r'completed\s+(?:shs|senior\s+high)|fresh(?:ers?|men)|first[- ]year|'
    r'level\s*100|new\s+entrants?|prospective\s+students?|'
    r'(?:seeking|gained|secured)\s+admission|newly\s+admitted|'
    r'high\s+school\s+(?:graduates?|leavers?)|entering\s+(?:university|tertiary)',
    re.I,
)
_CONTINUING_RE = re.compile(
    r'continuing\s+students?|currently\s+enrolled|level\s*[234]00|'
    r'second[- ]year|third[- ]year|final[- ]year',
    re.I,
)
_UNDERGRAD_RE = re.compile(
    r"undergraduate|bachelor'?s?|\bbsc\b|\bba\b|\bllb\b|degree\s+programme",
    re.I,
)
_SHS_RE = re.compile(
    r'(?:shs|senior\s+high(?:\s+school)?)\s+students?|'
    r'complete\s+(?:their\s+)?(?:shs|senior\s+high)|'
    r'\bform\s+(?:one|two|three|[123])\b',
    re.I,
)


def find_level_scope(text):
    """Classify who the award funds, or None when the page doesn't say.

    Order matters: "SHS graduates entering university" must read as tertiary
    entry, not as an SHS bursary, so entry patterns are checked before the
    SHS-student ones.
    """
    if not text:
        return None
    pg = bool(_PG_RE.search(text))
    entry = bool(_ENTRY_RE.search(text))
    continuing = bool(_CONTINUING_RE.search(text))
    undergrad = bool(_UNDERGRAD_RE.search(text))
    shs = bool(_SHS_RE.search(text))

    if pg and not (entry or continuing or undergrad or shs):
        return 'postgraduate'
    if entry and continuing:
        return 'tertiary_any'
    if entry:
        return 'tertiary_entry'
    if continuing:
        return 'tertiary_continuing'
    if undergrad:
        return 'tertiary_any'
    if shs:
        return 'shs'
    return None


# ── Regions ───────────────────────────────────────────

GHANA_REGIONS = [
    'Ahafo', 'Ashanti', 'Bono East', 'Bono', 'Central', 'Eastern',
    'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
    'Upper East', 'Upper West', 'Volta', 'Western North', 'Western',
]

# A region name only restricts eligibility when it appears in an
# eligibility-flavoured sentence — "our Accra office" must not shrink a
# nationwide award down to one region.
_REGION_CONTEXT_RE = re.compile(
    r'region|district|indigene|resident|native|hail|applicants?\s+from|'
    r'only\s+(?:for|open)|restricted|domiciled|originat',
    re.I,
)
_REGION_CONTEXT_WINDOW = 140


def find_regions(text):
    """Regions the page restricts eligibility to, or None (= no restriction)."""
    if not text:
        return None
    context_spans = [m.start() for m in _REGION_CONTEXT_RE.finditer(text)]
    if not context_spans:
        return None
    found = []
    for region in GHANA_REGIONS:
        for m in re.finditer(rf'\b{re.escape(region)}\b', text, re.I):
            if any(abs(m.start() - c) <= _REGION_CONTEXT_WINDOW for c in context_spans):
                if region not in found:
                    found.append(region)
                break
    # "Bono East" also matches the "Bono" pattern; keep both only when the
    # page really names both.
    if 'Bono' in found and 'Bono East' in found:
        plain_bono = re.search(r'\bBono\b(?!\s+East)', text, re.I)
        if not plain_bono:
            found.remove('Bono')
    return sorted(found) or None


# ── Programmes / disciplines ──────────────────────────

# keyword pattern -> canonical discipline name. Canonical names are broad on
# purpose: matching uses two-way substring containment, so 'Engineering'
# matches a profile that says 'BSc Computer Engineering'.
_PROGRAMME_KEYWORDS = [
    (r'computer\s+science', 'Computer Science'),
    (r'computer\s+engineering', 'Computer Engineering'),
    (r'software\s+engineering', 'Software Engineering'),
    (r'information\s+technology|\bict\b|information\s+systems', 'Information Technology'),
    (r'data\s+science|artificial\s+intelligence|machine\s+learning', 'Data Science'),
    (r'cyber\s*security', 'Cybersecurity'),
    (r'electrical(?:\s+and\s+electronic)?\s+engineering', 'Electrical Engineering'),
    (r'mechanical\s+engineering', 'Mechanical Engineering'),
    (r'civil\s+engineering', 'Civil Engineering'),
    (r'chemical\s+engineering', 'Chemical Engineering'),
    (r'petroleum|oil\s+and\s+gas', 'Petroleum Engineering'),
    (r'biomedical\s+engineering', 'Biomedical Engineering'),
    (r'aerospace|aeronautic', 'Aerospace Engineering'),
    (r'agricultural\s+engineering', 'Agricultural Engineering'),
    (r'materials?\s+(?:science|engineering)|metallurg', 'Materials Engineering'),
    (r'telecommunications?\s+engineering', 'Telecommunications Engineering'),
    (r'\bengineering\b', 'Engineering'),
    (r'medicine|medical\s+school|\bmbchb\b|\bmd\b\.?', 'Medicine'),
    (r'nursing', 'Nursing'),
    (r'midwifery', 'Midwifery'),
    (r'pharmacy|pharmaceutical', 'Pharmacy'),
    (r'dentistry|dental', 'Dentistry'),
    (r'public\s+health', 'Public Health'),
    (r'physician\s+assistant', 'Physician Assistantship'),
    (r'medical\s+laboratory|biomedical\s+science', 'Medical Laboratory Science'),
    (r'veterinary', 'Veterinary Medicine'),
    (r'optometry', 'Optometry'),
    (r'radiography|sonography', 'Radiography'),
    (r'physiotherapy', 'Physiotherapy'),
    (r'agriculture|agribusiness|agronomy|crop\s+science|animal\s+science', 'Agriculture'),
    (r'forestry|natural\s+resources', 'Natural Resources Management'),
    (r'food\s+science|nutrition|dietetics', 'Food Science and Nutrition'),
    (r'fisheries|aquaculture', 'Fisheries and Aquaculture'),
    (r'environmental\s+(?:science|studies|management)', 'Environmental Science'),
    (r'mathematics|mathematical', 'Mathematics'),
    (r'statistics|statistical', 'Statistics'),
    (r'actuarial', 'Actuarial Science'),
    (r'physics', 'Physics'),
    (r'chemistry', 'Chemistry'),
    (r'biochemistry', 'Biochemistry'),
    (r'biology|biological\s+science|biotechnology', 'Biological Sciences'),
    (r'geology|geological|earth\s+science', 'Geology'),
    (r'geomatic|geodetic|surveying', 'Geomatic Engineering'),
    (r'business\s+administration', 'Business Administration'),
    (r'accounting|accountancy', 'Accounting'),
    (r'\bfinance\b|banking', 'Banking and Finance'),
    (r'economics', 'Economics'),
    (r'marketing', 'Marketing'),
    (r'human\s+resource', 'Human Resource Management'),
    (r'procurement|supply\s+chain|logistics', 'Procurement and Supply Chain'),
    (r'hospitality|tourism', 'Hospitality and Tourism'),
    (r'\blaw\b|\bllb\b|legal\s+studies', 'Law'),
    (r'political\s+science', 'Political Science'),
    (r'sociology', 'Sociology'),
    (r'social\s+work', 'Social Work'),
    (r'psychology', 'Psychology'),
    (r'international\s+(?:relations|affairs)', 'International Relations'),
    (r'communication\s+studies|journalism|media\s+studies', 'Communication Studies'),
    (r'\benglish\b|linguistics|literature', 'English and Linguistics'),
    (r'history', 'History'),
    (r'philosophy', 'Philosophy'),
    (r'religio(?:n|us)|theology', 'Religious Studies'),
    (r'fine\s+art|graphic\s+design|industrial\s+art', 'Fine and Applied Arts'),
    (r'music', 'Music'),
    (r'theatre|performing\s+arts', 'Theatre Arts'),
    (r'architecture', 'Architecture'),
    (r'building\s+technology|construction', 'Construction Technology'),
    (r'real\s+estate|land\s+economy|estate\s+management', 'Land Economy'),
    (r'planning|urban\s+and\s+regional', 'Development Planning'),
    (r'education|teaching|teacher\s+training|pedagog', 'Education'),
]

# "STEM" expands to the standard set rather than matching any one discipline.
_STEM_SET = [
    'Engineering', 'Computer Science', 'Information Technology',
    'Mathematics', 'Physics', 'Chemistry', 'Biological Sciences',
]

_PROGRAMME_CONTEXT_RE = re.compile(
    r'stud(?:y|ies|ying|ents?)|pursu|programme|program\b|course|field|'
    r'discipline|degree|major|reading|offer(?:ing|ed)?|area',
    re.I,
)
_PROGRAMME_CONTEXT_WINDOW = 160


def find_programmes(text):
    """Disciplines the page restricts the award to, or None (= open to all)."""
    if not text:
        return None
    context_spans = [m.start() for m in _PROGRAMME_CONTEXT_RE.finditer(text)]
    if not context_spans:
        return None
    found = []

    def near_context(pos):
        return any(abs(pos - c) <= _PROGRAMME_CONTEXT_WINDOW for c in context_spans)

    if re.search(r'\bSTEM\b', text) and any(
        near_context(m.start()) for m in re.finditer(r'\bSTEM\b', text)
    ):
        found.extend(_STEM_SET)

    for pattern, canonical in _PROGRAMME_KEYWORDS:
        if canonical in found:
            continue
        for m in re.finditer(pattern, text, re.I):
            if near_context(m.start()):
                found.append(canonical)
                break

    # A page that lists half the university's catalogue isn't restricting
    # anything — it's a prospectus. Treat it as open to all.
    if len(found) > 12:
        return None
    return found or None


# ── Misc scalar fields ────────────────────────────────

_NEED_RE = re.compile(
    r'financial(?:ly)?\s+(?:need|needy|disadvantaged|challenged)|'
    r'brilliant\s+but\s+needy|low[- ]income|underprivileged|'
    r'under[- ]?served|less\s+privileged|demonstrated\s+need',
    re.I,
)


def find_need_based(text):
    """True when the page says the award targets financial need, else None."""
    if text and _NEED_RE.search(text):
        return True
    return None


def find_slots(text):
    """Number of awards on offer, or None."""
    if not text:
        return None
    m = re.search(
        r'(?:up\s+to|about|approximately|over)?\s*(\d{1,4})\s+'
        r'(?:scholarships?|awards?|slots?|beneficiaries|recipients|'
        r'students?\s+(?:will|shall)\s+(?:be|receive))',
        text, re.I,
    )
    if m:
        n = int(m.group(1))
        if 1 <= n <= 5000:
            return n
    return None


def find_max_aggregate(text):
    """WASSCE aggregate ceiling stated on the page, or None."""
    if not text:
        return None
    m = re.search(
        r'aggregate\s+(?:of\s+|score\s+of\s+)?(\d{1,2})\s*(?:or\s+(?:better|less|lower))?',
        text, re.I,
    )
    if m:
        n = int(m.group(1))
        if 6 <= n <= 36:
            return n
    return None


# ── Structured lists (benefits, documents) ────────────

_BENEFITS_HEADING_RE = re.compile(
    r'benefit|package|what\s+(?:you|the\s+scholar)|covers|includes?|'
    r'value\s+of|entitlement|the\s+award\s+provides',
    re.I,
)
_DOCUMENTS_HEADING_RE = re.compile(
    r'documents?|requirements?|what\s+you\s+need|how\s+to\s+apply|eligib',
    re.I,
)
_DOCUMENT_ITEM_RE = re.compile(
    r'transcript|certificate|letter|\bcv\b|r[eé]sum[eé]|statement|card|'
    r'slip|passport|photo|results?|essay|proposal|birth|\bid\b|'
    r'testimonial|recommendation|admission',
    re.I,
)


def _list_after_heading(soup, heading_re, max_items=8):
    """Items of the first <ul>/<ol> that follows a matching heading."""
    for heading in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'strong', 'b']):
        if not heading_re.search(heading.get_text(strip=True) or ''):
            continue
        lst = heading.find_next(['ul', 'ol'])
        if not lst:
            continue
        items = []
        for li in lst.find_all('li', recursive=False) or lst.find_all('li'):
            item_text = li.get_text(' ', strip=True)
            if 3 <= len(item_text) <= 140:
                items.append(item_text)
            if len(items) >= max_items:
                break
        if items:
            return items
    return None


def find_benefits(soup):
    return _list_after_heading(soup, _BENEFITS_HEADING_RE)


def find_documents(soup):
    items = _list_after_heading(soup, _DOCUMENTS_HEADING_RE, max_items=10)
    if not items:
        return None
    docs = [i for i in items if _DOCUMENT_ITEM_RE.search(i)]
    return docs or None


def find_summary(soup):
    """First substantive paragraphs of the page's main content."""
    root = soup.find('article') or soup.find('main') or soup
    paras = []
    for p in root.find_all('p'):
        p_text = p.get_text(' ', strip=True)
        if len(p_text) >= 80:
            paras.append(p_text)
        if len(paras) >= 2:
            break
    if paras:
        return ' '.join(paras)[:1500]
    return None


# ── Top-level API ─────────────────────────────────────

def extract_from_html(html):
    """Mine one scholarship page. Returns only the fields the page states."""
    soup = BeautifulSoup(html, 'html.parser')
    # Page chrome (nav menus, footers) is full of misleading words; strip it
    # before text analysis.
    for tag in soup.find_all(['nav', 'footer', 'header', 'script', 'style', 'aside']):
        tag.decompose()
    text = soup.get_text(' ', strip=True)
    return extract_from_text(text, soup=soup)


def extract_from_text(text, soup=None):
    """Same as extract_from_html for callers that already have plain text."""
    out = {}
    deadline = find_deadline(text)
    if deadline:
        out['deadline'] = deadline
    amount = find_amount(text)
    if amount:
        out['amount'], out['amount_value'] = amount
    level_scope = find_level_scope(text)
    if level_scope:
        out['level_scope'] = level_scope
    regions = find_regions(text)
    if regions:
        out['region'] = regions
    programmes = find_programmes(text)
    if programmes:
        out['programmes'] = programmes
    if find_need_based(text):
        out['need_based'] = True
    slots = find_slots(text)
    if slots:
        out['slots'] = slots
    max_aggregate = find_max_aggregate(text)
    if max_aggregate:
        out['max_aggregate'] = max_aggregate

    if soup is not None:
        benefits = find_benefits(soup)
        if benefits:
            out['benefits'] = benefits
        documents = find_documents(soup)
        if documents:
            out['documents'] = documents
        summary = find_summary(soup)
        if summary:
            out['summary'] = summary
    return out


# Values that mean "the scraper didn't find this", and so may be overwritten
# by detail-page extraction. Anything else was genuinely scraped and wins.
_EMPTY = {
    'deadline': (None,),
    'amount': (None, '', 'Variable'),
    'amount_value': (None, 0),
    'level_scope': (None, '', 'unknown'),
    'region': (None, [], ['All']),
    'programmes': (None, [], ['All']),
    'need_based': (None, False),
    'slots': (None, 0),
    'max_aggregate': (None, 36),
    'benefits': (None, []),
    'documents': (None, []),
    'summary': (None, ''),
}


def merge_extracted(item, extracted):
    """Fill an item's missing fields from detail-page extraction, in place.

    Listing-page data that actually exists is kept — the detail page only
    supplies what the listing didn't.
    """
    for key, value in extracted.items():
        blanks = _EMPTY.get(key)
        if blanks is None:
            continue
        if item.get(key) in blanks:
            item[key] = value
    return item


# ── Listing parsing (shared by all scraper backends) ──

def _card_link(container, title_el, base_url):
    """Absolute URL of the card's own page, or None."""
    if title_el.name == 'a' and title_el.get('href'):
        link_el = title_el
    else:
        link_el = title_el.find('a', href=True) or container.find('a', href=True)
    if not link_el:
        return None
    href = (link_el.get('href') or '').strip()
    if not href or href.startswith(('#', 'mailto:', 'javascript:')):
        return None
    full = urljoin(base_url, href)
    if urlparse(full).scheme not in ('http', 'https'):
        return None
    return full


def parse_listing_soup(soup, base_url, *, container_re, keywords, provider,
                       provider_type, tags, relevance_check, limit=8):
    """Walk a listing page's cards into scholarship items.

    Each item carries 'detail_url' (the card's own page, for follow-up
    fetching) plus whatever the card text itself states, mined through the
    same extractors as detail pages. relevance_check is base.is_relevant_title
    — passed in to avoid a circular import.
    """
    containers = soup.find_all(
        ['article', 'div', 'section', 'li'],
        class_=re.compile(container_re, re.I),
    )
    items = []
    seen = set()
    for container in containers:
        title_el = container.find(['h1', 'h2', 'h3', 'h4', 'a'])
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title or len(title) < 10:
            continue
        if keywords and not any(kw in title.lower() for kw in keywords):
            continue
        if not relevance_check(title):
            continue
        if title.lower() in seen:
            continue
        seen.add(title.lower())

        desc_el = container.find(
            ['p', 'div'], class_=re.compile(r'excerpt|summary|desc|content', re.I)
        ) or container.find('p')
        description = desc_el.get_text(strip=True) if desc_el else ''

        link = _card_link(container, title_el, base_url)
        item = {
            'name': title[:200],
            'provider': provider,
            'provider_type': provider_type,
            'summary': description[:500],
            'tags': list(tags),
            'source_url': link or base_url,
            'detail_url': link,
        }
        merge_extracted(item, extract_from_text(container.get_text(' ', strip=True)))
        items.append(item)
        if len(items) >= limit:
            break
    return items


def single_item_from_page(html, url, *, heading_keywords, provider,
                          provider_type, tags, relevance_check, name_prefix=''):
    """One item mined from a single-programme page (Chevening, DAAD, ...).

    These providers describe one scholarship across a whole page rather than
    listing cards, so the page itself is the detail page: pick the best
    heading for the name and extract everything else from the full text.
    """
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup.find_all(['nav', 'footer', 'header', 'script', 'style', 'aside']):
        tag.decompose()

    name = None
    for heading in soup.find_all(['h1', 'h2', 'h3', 'h4']):
        heading_text = heading.get_text(strip=True)
        if not heading_text or len(heading_text) < 6:
            continue
        if not any(kw in heading_text.lower() for kw in heading_keywords):
            continue
        if not relevance_check(heading_text):
            continue
        name = heading_text
        break
    if not name:
        return None
    if name_prefix and name_prefix.strip().lower() not in name.lower():
        name = f'{name_prefix}{name}'

    item = {
        'name': name[:200],
        'provider': provider,
        'provider_type': provider_type,
        'tags': list(tags),
        'source_url': url,
    }
    text = soup.get_text(' ', strip=True)
    merge_extracted(item, extract_from_text(text, soup=soup))
    return item
