import logging
import re

import requests
from bs4 import BeautifulSoup

from .base import BaseScraper, is_relevant_title
from .extract import (
    extract_from_html, extract_from_text, merge_extracted, parse_listing_soup,
)

logger = logging.getLogger(__name__)

# Detail pages fetched per source per run. Every fetch is rate-limited, so
# this bounds how long a run takes and how hard we hit a site.
MAX_DETAIL_PAGES = 6


class GenericScraper(BaseScraper):
    """Scraper using requests + BeautifulSoup for static/server-rendered pages.

    Much lighter than Selenium/Playwright — no browser needed. Best for
    aggregator sites, university pages, and international org listings.

    Two-stage pipeline: parse the listing page into candidate items, then
    follow each item's own link and mine the full detail page for deadline,
    amount, level, regions, programmes, benefits and documents. Only what a
    page actually states is stored; a field the pages never mention stays at
    its honest default and the matching engine caps the row at Partial.
    """

    def _create_session(self) -> requests.Session:
        """Create a requests Session with stealth headers."""
        session = requests.Session()
        session.headers.update(self.rate_limiter.get_headers())
        session.headers['Accept-Encoding'] = 'gzip, deflate'
        session.headers['Connection'] = 'keep-alive'
        return session

    def _safe_get(self, session: requests.Session, url: str, **kwargs) -> requests.Response:
        """Fetch a URL with rate limiting and retry logic."""
        self.rate_limiter.wait_for_domain(url)
        kwargs.setdefault('timeout', 20)

        for attempt in range(self.rate_limiter.max_retries + 1):
            try:
                response = session.get(url, **kwargs)
                if self.rate_limiter.handle_response(response, attempt):
                    continue  # Retry after backoff
                response.raise_for_status()
                return response
            except requests.exceptions.HTTPError as e:
                if attempt < self.rate_limiter.max_retries and hasattr(e, 'response') and e.response is not None:
                    if e.response.status_code in (429, 503):
                        continue
                raise
        raise requests.exceptions.RetryError(f"Max retries exceeded for {url}")

    def scrape(self) -> list[dict]:
        """Dispatch to source-specific scraper based on source name."""
        name_lower = self.source.name.lower()
        session = self._create_session()

        try:
            if 'africanscholarships' in name_lower or 'african scholarship' in name_lower:
                return self._scrape_source(session, **self.AFRICAN_SCHOLARSHIPS)
            elif 'opportunitydesk' in name_lower or 'opportunity desk' in name_lower:
                return self._scrape_source(session, **self.OPPORTUNITY_DESK)
            elif 'knust' in name_lower:
                return self._scrape_source(session, **self.KNUST)
            elif 'university of ghana' in name_lower or 'legon' in name_lower:
                return self._scrape_source(session, **self.UG)
            elif 'african union' in name_lower:
                return self._scrape_source(session, **self.AFRICAN_UNION)
            elif 'world bank' in name_lower:
                return self._scrape_source(session, **self.WORLD_BANK)
            else:
                return self._scrape_generic(session)
        finally:
            session.close()

    # ──────────────────────────────────────────────────────────────
    # Source configurations
    # ──────────────────────────────────────────────────────────────
    AFRICAN_SCHOLARSHIPS = {
        'extra_urls': [
            'https://africanscholarships.com/ghana/',
            'https://africanscholarships.com/category/ghana/',
            'https://africanscholarships.com/',
        ],
        'container_re': r'post|entry|card|listing|scholarship',
        'keywords': [
            'scholarship', 'grant', 'bursary', 'award', 'fellowship',
            'fund', 'opportunity', 'ghana', 'african',
        ],
        'provider': 'AfricanScholarships.com',
        'provider_type': 'Foundation',
        'tags': ['Aggregator', 'Africa', 'Ghana'],
        'fallback_key': 'africanscholarships',
    }

    OPPORTUNITY_DESK = {
        'extra_urls': [
            'https://opportunitydesk.org/category/scholarships/',
            'https://opportunitydesk.org/?s=ghana+scholarship',
            'https://opportunitydesk.org/',
        ],
        'container_re': r'post|entry|card|listing',
        'keywords': [
            'scholarship', 'fellowship', 'grant', 'award',
            'opportunity', 'fund', 'programme',
        ],
        'provider': 'OpportunityDesk.org',
        'provider_type': 'Foundation',
        'tags': ['Aggregator', 'International'],
        'fallback_key': 'opportunitydesk',
    }

    KNUST = {
        'extra_urls': [
            'https://www.knust.edu.gh/students/scholarships-and-grants',
            'https://www.knust.edu.gh/academics/sfso/scholarships',
        ],
        'container_re': r'post|entry|card|content|scholarship|news',
        'keywords': [
            'scholarship', 'bursary', 'award', 'grant', 'financial aid', 'funding',
        ],
        'provider': 'KNUST',
        'provider_type': 'Government',
        'tags': ['University', 'KNUST'],
        'fallback_key': 'knust',
    }

    UG = {
        'extra_urls': [
            'https://www.ug.edu.gh/financialaid/',
            'https://www.ug.edu.gh/financialaid/scholarship/ug-sponsorship',
        ],
        'container_re': r'post|entry|card|content|scholarship|field',
        'keywords': ['scholarship', 'bursary', 'award', 'grant', 'financial'],
        'provider': 'University of Ghana',
        'provider_type': 'Government',
        'tags': ['University', 'UG'],
        'fallback_key': 'university_of_ghana',
    }

    AFRICAN_UNION = {
        'extra_urls': [
            'https://au.int/en/scholarship',
            'https://au.int/en/education',
        ],
        'container_re': r'post|entry|card|content|views-row|node',
        'keywords': None,  # AU headings rarely contain "scholarship"; the relevance gate filters
        'provider': 'African Union',
        'provider_type': 'International',
        'tags': ['International', 'African Union', 'Pan-African'],
        'fallback_key': 'african_union',
    }

    WORLD_BANK = {
        'extra_urls': [
            'https://www.worldbank.org/en/programs/scholarships',
            'https://www.worldbank.org/en/about/careers/programs-and-internships',
        ],
        'container_re': r'post|entry|card|content|feature|body',
        'keywords': [
            'scholarship', 'fellowship', 'program', 'grant', 'jj/wbgsp', 'africa',
        ],
        'provider': 'World Bank Group',
        'provider_type': 'International',
        'tags': ['International', 'World Bank', 'Development'],
        'fallback_key': 'world_bank',
    }

    # ──────────────────────────────────────────────────────────────
    # Pipeline
    # ──────────────────────────────────────────────────────────────
    def _scrape_source(self, session, *, extra_urls, container_re, keywords,
                       provider, provider_type, tags, fallback_key) -> list[dict]:
        items = []
        for url in [self.source.url] + extra_urls:
            try:
                response = self._safe_get(session, url)
            except Exception as e:
                logger.warning(f"{self.source.name} URL {url} failed: {e}")
                continue
            soup = BeautifulSoup(response.text, 'html.parser')
            items = parse_listing_soup(
                soup, url,
                container_re=container_re,
                keywords=keywords,
                provider=provider,
                provider_type=provider_type,
                tags=tags,
                relevance_check=is_relevant_title,
            )
            if items:
                break

        if not items:
            return self.use_fallback(fallback_key)
        return self._follow_details(session, items)

    def _follow_details(self, session, items: list[dict]) -> list[dict]:
        """Fetch each item's own page and mine it for the fields the listing
        card didn't state."""
        for item in items[:MAX_DETAIL_PAGES]:
            url = item.get('detail_url')
            if not url:
                continue
            try:
                response = self._safe_get(session, url)
                merge_extracted(item, extract_from_html(response.text))
            except Exception as e:
                logger.warning(f"{self.source.name}: detail page {url} failed: {e}")
        for item in items:
            item.pop('detail_url', None)
        return items

    # ──────────────────────────────────────────────────────────────
    # Generic fallback for unknown static sources
    # ──────────────────────────────────────────────────────────────
    def _scrape_generic(self, session) -> list[dict]:
        """Generic BeautifulSoup scraper for unknown static sources."""
        scholarships = []
        try:
            response = self._safe_get(session, self.source.url)
            soup = BeautifulSoup(response.text, 'html.parser')

            scholarships = parse_listing_soup(
                soup, self.source.url,
                container_re=r'scholarship|grant|bursary|award|funding|opportunity',
                keywords=None,
                provider=self.source.name,
                provider_type=self.source.provider_type,
                tags=[],
                relevance_check=is_relevant_title,
                limit=10,
            )

            # Strategy 2: no cards — mine headings directly.
            if not scholarships:
                for heading in soup.find_all(['h1', 'h2', 'h3']):
                    text = heading.get_text(strip=True)
                    if any(kw in text.lower() for kw in [
                        'scholarship', 'grant', 'bursary', 'award', 'fund'
                    ]) and len(text) > 10:
                        next_p = heading.find_next('p')
                        desc = next_p.get_text(strip=True) if next_p else ''
                        item = {
                            'name': text[:200],
                            'provider': self.source.name,
                            'provider_type': self.source.provider_type,
                            'summary': desc[:500],
                            'source_url': self.source.url,
                        }
                        merge_extracted(item, extract_from_text(
                            f'{text} {desc}'
                        ))
                        scholarships.append(item)

        except Exception as e:
            logger.error(f"Generic scraping failed for {self.source.url}: {e}")
            raise

        return self._follow_details(session, scholarships)
