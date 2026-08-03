import logging
import time

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

from .base import BaseScraper, is_relevant_title
from .extract import extract_from_html, merge_extracted, parse_listing_soup

logger = logging.getLogger(__name__)

# Detail pages visited per source per run — each one is a full browser
# navigation, so keep this tight.
MAX_DETAIL_PAGES = 5


class SeleniumScraper(BaseScraper):
    """Scraper using Selenium for JavaScript-heavy government and corporate sites.

    Same two-stage pipeline as GenericScraper: parse listing cards, then
    navigate to each card's own page and mine the full text for deadline,
    amount, level, regions, programmes, benefits and documents. Only what a
    page states is stored — nothing is invented for live-scraped rows.
    """

    def _create_driver(self):
        """Create a headless Chrome WebDriver with stealth options."""
        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-gpu')
        options.add_argument(f'--user-agent={self.rate_limiter.get_random_user_agent()}')
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)

        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options,
        )
        # Remove webdriver property to avoid detection
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
        })
        driver.set_page_load_timeout(30)
        return driver

    def _safe_get(self, driver, url, wait_seconds=3):
        """Navigate to URL with rate limiting and a short stabilization wait."""
        self.rate_limiter.wait_for_domain(url)
        driver.get(url)
        time.sleep(wait_seconds)

    def scrape(self) -> list[dict]:
        """Dispatch to source-specific scraper based on source name."""
        name_lower = self.source.name.lower()
        driver = self._create_driver()
        try:
            if 'getfund' in name_lower:
                return self._scrape_source(driver, **self.GETFUND)
            elif 'mtn' in name_lower:
                return self._scrape_source(driver, **self.MTN)
            elif 'secretariat' in name_lower or 'district' in name_lower:
                return self._scrape_source(driver, **self.SECRETARIAT)
            else:
                return self._scrape_generic(driver)
        finally:
            driver.quit()

    # ──────────────────────────────────────────────────────────────
    # Source configurations
    # ──────────────────────────────────────────────────────────────
    GETFUND = {
        'extra_urls': [
            'https://getfund.gov.gh/scholarships/',
            'https://getfund.gov.gh/category/scholarships/',
            'https://getfund.gov.gh/news/',
        ],
        'container_re': r'post|entry|article|card|scholarship|notice',
        'keywords': [
            'scholarship', 'bursary', 'grant', 'award', 'fund',
            'stipend', 'getfund', 'tuition',
        ],
        'provider': 'Ghana Education Trust Fund',
        'provider_type': 'Government',
        'tags': ['Government', 'GETFund'],
        'fallback_key': 'getfund',
    }

    MTN = {
        'extra_urls': [
            'https://mtn.com.gh/foundation/scholarships/',
            'https://mtn.com.gh/foundation/what-we-do/',
            'https://mtn.com.gh/foundation/',
        ],
        'container_re': r'scholarship|program|initiative|bright|education',
        'keywords': ['scholarship', 'bright', 'bursary', 'education', 'stem'],
        'provider': 'MTN Ghana Foundation',
        'provider_type': 'Corporate',
        'tags': ['Corporate', 'MTN'],
        'fallback_key': 'mtn',
    }

    SECRETARIAT = {
        'extra_urls': [
            'https://scholarships.gov.gh/opportunities',
            'https://scholarships.gov.gh/programmes',
            'https://scholarships.gov.gh/',
        ],
        'container_re': r'post|entry|card|scholarship|listing',
        'keywords': [
            'scholarship', 'district', 'bursary', 'government', 'secretariat',
        ],
        'provider': 'Ghana Scholarships Secretariat',
        'provider_type': 'Government',
        'tags': ['Government', 'Secretariat'],
        'fallback_key': 'secretariat',
    }

    # ──────────────────────────────────────────────────────────────
    # Pipeline
    # ──────────────────────────────────────────────────────────────
    def _scrape_source(self, driver, *, extra_urls, container_re, keywords,
                       provider, provider_type, tags, fallback_key) -> list[dict]:
        items = []
        for url in [self.source.url] + extra_urls:
            try:
                self._safe_get(driver, url, wait_seconds=4)
                soup = BeautifulSoup(driver.page_source, 'html.parser')
            except Exception as e:
                logger.warning(f"{self.source.name} URL {url} failed: {e}")
                continue
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
        return self._follow_details(driver, items)

    def _follow_details(self, driver, items: list[dict]) -> list[dict]:
        """Navigate to each item's own page and mine what the card didn't state."""
        for item in items[:MAX_DETAIL_PAGES]:
            url = item.get('detail_url')
            if not url:
                continue
            try:
                self._safe_get(driver, url, wait_seconds=3)
                merge_extracted(item, extract_from_html(driver.page_source))
            except Exception as e:
                logger.warning(f"{self.source.name}: detail page {url} failed: {e}")
        for item in items:
            item.pop('detail_url', None)
        return items

    # ──────────────────────────────────────────────────────────────
    # Generic fallback — any Selenium source
    # ──────────────────────────────────────────────────────────────
    def _scrape_generic(self, driver) -> list[dict]:
        """Generic Selenium scraper for unknown sources."""
        scholarships = []
        try:
            self._safe_get(driver, self.source.url, wait_seconds=5)
            soup = BeautifulSoup(driver.page_source, 'html.parser')

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

            if not scholarships:
                for heading in soup.find_all(['h1', 'h2', 'h3']):
                    text = heading.get_text(strip=True)
                    if any(kw in text.lower() for kw in [
                        'scholarship', 'grant', 'bursary', 'award', 'fund'
                    ]) and len(text) > 10:
                        next_p = heading.find_next('p')
                        desc = next_p.get_text(strip=True) if next_p else ''
                        scholarships.append({
                            'name': text[:200],
                            'provider': self.source.name,
                            'provider_type': self.source.provider_type,
                            'summary': desc[:500],
                            'source_url': self.source.url,
                        })

        except Exception as e:
            logger.error(f"Generic Selenium scraping failed for {self.source.url}: {e}")
            raise

        return self._follow_details(driver, scholarships)
