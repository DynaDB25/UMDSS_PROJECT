"""Structured-feed scraper — the reliable core of the pipeline.

Instead of guessing at a site's HTML classes (which silently rot the moment a
site restyles), this reads machine-readable feeds that sites publish for exactly
this purpose:

  * WordPress REST API  (mode='wp')  -> /wp-json/wp/v2/posts as JSON
  * RSS / Atom feeds     (mode='rss') -> /feed/ as XML

Both return title, canonical link, publish date and full content as data, so a
cosmetic redesign of the site doesn't break scraping. Per-source configuration
lives in ScrapingSource.scrape_config, e.g.:

    {"mode": "wp",  "endpoints": ["https://site/wp-json/wp/v2/posts"],
     "search": "scholarship", "per_page": 30, "max_items": 25, "tags": [...]}
    {"mode": "rss", "endpoints": ["https://site/category/x/feed/"], "max_items": 25}
"""
import html
import logging
import re
from datetime import date, timedelta

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

from .base import BaseScraper, SCHOLARSHIP_SIGNAL_RE, JUNK_TITLE_RE

logger = logging.getLogger(__name__)

_TAG_RE = re.compile(r'<[^>]+>')
_WS_RE = re.compile(r'\s+')

_MONTHS = (r'(?:January|February|March|April|May|June|July|August|September|'
           r'October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)')
_DATE_RES = [
    re.compile(rf'\b\d{{1,2}}(?:st|nd|rd|th)?\s+{_MONTHS}\.?\s+\d{{4}}\b', re.I),   # 14 August 2026
    re.compile(rf'\b{_MONTHS}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}\b', re.I),  # August 14, 2026
    re.compile(r'\b\d{4}-\d{2}-\d{2}\b'),                                            # 2026-08-14
    re.compile(r'\b\d{1,2}/\d{1,2}/\d{4}\b'),                                        # 14/08/2026
]
_DEADLINE_CUE = re.compile(
    r'(?:application\s+)?deadline|closing date|apply(?:ing)?\s+by|applications?\s+close', re.I)


def clean_text(raw):
    if not raw:
        return ''
    return _WS_RE.sub(' ', html.unescape(_TAG_RE.sub(' ', raw))).strip()


def _parse_date(s):
    for rx in _DATE_RES:
        m = rx.search(s)
        if m:
            try:
                return dateparser.parse(m.group(0), dayfirst=False).date()
            except (ValueError, OverflowError):
                continue
    return None


def extract_deadline(text):
    """Return a deadline only when a date sits next to a deadline cue.

    Never invents "today + N days"; a listing that states no deadline keeps
    None, which the matching engine treats honestly.
    """
    if not text:
        return None
    cue = _DEADLINE_CUE.search(text)
    if not cue:
        return None
    window = text[cue.start(): cue.start() + 60]
    d = _parse_date(window)
    # Guard against a mis-parsed date far in the past (stale listing / bad match).
    if d and d >= date.today() - timedelta(days=30):
        return d
    return None


def extract_amount(text):
    if not text:
        return 'Variable'
    if re.search(r'fully[\s-]?funded|full funding|full scholarship|full tuition|fully financed', text, re.I):
        return 'Fully funded'
    m = re.search(r'(?:US\$|USD|\$|£|GBP|€|EUR|GH[₵C]|₦|NGN)\s?[\d,]{2,}(?:\.\d+)?', text)
    if m:
        return m.group(0).strip()[:100]
    if re.search(r'\bstipend\b|\ballowance\b|monthly grant', text, re.I):
        return 'Funded (see listing)'
    return 'Variable'


def detect_level(text):
    t = (text or '').lower()
    if re.search(r'postgraduate|post-graduate|master(?:\'s|s)?\b|\bmsc\b|\bma\b|ph\.?d|doctoral|doctorate|graduate study', t):
        return 'postgraduate'
    if re.search(r'undergraduate|bachelor|\bbsc\b|\bba\b|first degree', t):
        return 'tertiary_any'
    return 'unknown'


class ApiScraper(BaseScraper):
    """Scraper for WordPress REST APIs and RSS feeds (config-driven)."""

    def _session(self):
        s = requests.Session()
        s.headers.update(self.rate_limiter.get_headers())
        return s

    def _get(self, session, url, **kw):
        self.rate_limiter.wait_for_domain(url)
        kw.setdefault('timeout', 25)
        for attempt in range(self.rate_limiter.max_retries + 1):
            resp = session.get(url, **kw)
            if self.rate_limiter.handle_response(resp, attempt):
                continue
            resp.raise_for_status()
            return resp
        raise requests.exceptions.RetryError(f"Max retries for {url}")

    # ── relevance: lean on the shared signal, but allow long feed titles ──
    def is_relevant(self, item):
        name = (item.get('name') or '').strip()
        if len(name) < 8:
            return False
        # Skip weekly round-up posts ("30 Scholarships Currently Open ...").
        if re.match(r'^\d+\s', name) and re.search(r'currently open|open (?:now|this)|round[\s-]?up', name, re.I):
            return False
        if JUNK_TITLE_RE.search(name):
            return False
        haystack = f"{name} {item.get('summary', '')}"
        return bool(SCHOLARSHIP_SIGNAL_RE.search(haystack))

    # ── pipeline ──
    def scrape(self):
        cfg = self.source.scrape_config or {}
        mode = cfg.get('mode', 'wp')
        endpoints = cfg.get('endpoints') or []
        if not endpoints:
            logger.warning(f"{self.source.name}: no endpoints in scrape_config; nothing to scrape.")
            return []

        session = self._session()
        items, seen = [], set()
        try:
            for url in endpoints:
                try:
                    got = self._scrape_rss(session, url) if mode == 'rss' else self._scrape_wp(session, url, cfg)
                except Exception as e:
                    logger.warning(f"{self.source.name}: endpoint failed {url}: {e}")
                    continue
                for it in got:
                    link = it.get('source_url')
                    if link and link in seen:
                        continue
                    seen.add(link)
                    items.append(it)
            logger.info(f"{self.source.name}: pulled {len(items)} raw item(s) from {len(endpoints)} endpoint(s).")
            return items[: cfg.get('max_items', 25)]
        finally:
            session.close()

    def _make(self, title, link, summary_html, extract_text):
        title = clean_text(title)
        summary = clean_text(summary_html)
        blob = f"{title}. {extract_text}"
        cfg = self.source.scrape_config or {}
        return {
            'name': title,
            'provider': self.source.name,
            'provider_type': self.source.provider_type,
            'source_url': (link or self.source.url).strip(),
            'summary': (summary or title)[:1000],
            'deadline': extract_deadline(extract_text) or extract_deadline(title),
            'amount': extract_amount(blob),
            'level_scope': detect_level(blob),
            'region': ['All'],
            'programmes': ['All'],
            'tags': cfg.get('tags', []),
        }

    def _scrape_wp(self, session, base_url, cfg):
        params = {'per_page': cfg.get('per_page', 30), '_fields': 'title,link,date,excerpt,content'}
        if cfg.get('search'):
            params['search'] = cfg['search']
        data = self._get(session, base_url, params=params).json()
        if not isinstance(data, list):
            return []
        out = []
        for post in data:
            title = (post.get('title') or {}).get('rendered', '')
            if not title:
                continue
            excerpt = (post.get('excerpt') or {}).get('rendered', '')
            content = (post.get('content') or {}).get('rendered', '')
            extract_text = f"{clean_text(excerpt)} {clean_text(content)}"
            out.append(self._make(title, post.get('link', ''), excerpt or content, extract_text))
        return out

    def _scrape_rss(self, session, feed_url):
        soup = BeautifulSoup(self._get(session, feed_url).content, 'xml')
        out = []
        for it in soup.find_all(['item', 'entry']):
            title = it.find('title').get_text() if it.find('title') else ''
            if not title:
                continue
            link_el = it.find('link')
            link = (link_el.get_text() or link_el.get('href', '')) if link_el else ''
            desc = it.find('description').get_text() if it.find('description') else ''
            encoded = ''
            for child in it.find_all():
                if child.name and child.name.lower() == 'encoded':
                    encoded = child.get_text()
                    break
            summary_html = desc or encoded
            extract_text = f"{clean_text(desc)} {clean_text(encoded)}"
            out.append(self._make(title, link, summary_html, extract_text))
        return out
