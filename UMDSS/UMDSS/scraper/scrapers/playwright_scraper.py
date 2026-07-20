import logging

from asgiref.sync import async_to_sync

from .base import BaseScraper, is_relevant_title
from .extract import single_item_from_page

logger = logging.getLogger(__name__)


class PlaywrightScraper(BaseScraper):
    """Scraper using Playwright for modern SPAs and JavaScript-heavy sites.

    The Playwright sources are single-programme providers (Mastercard,
    Chevening, Stanbic, DAAD, Commonwealth): one scholarship described across
    a whole page rather than a listing of cards. The loaded page therefore IS
    the detail page — the name comes from its best heading and every other
    field is mined from the full page text. Nothing is invented for
    live-scraped rows; a field the page doesn't state stays at its default.
    """

    def scrape(self) -> list[dict]:
        """Synchronous wrapper for the async Playwright scraper."""
        return async_to_sync(self._async_scrape)()

    async def _async_scrape(self) -> list[dict]:
        """Dispatch to source-specific async scraper."""
        name_lower = self.source.name.lower()

        if 'mastercard' in name_lower:
            return await self._scrape_single_programme(**self.MASTERCARD)
        elif 'chevening' in name_lower:
            return await self._scrape_single_programme(**self.CHEVENING)
        elif 'stanbic' in name_lower:
            return await self._scrape_single_programme(**self.STANBIC)
        elif 'daad' in name_lower:
            return await self._scrape_single_programme(**self.DAAD)
        elif 'commonwealth' in name_lower:
            return await self._scrape_single_programme(**self.COMMONWEALTH)
        else:
            return await self._scrape_generic_pw()

    async def _launch_browser(self):
        from playwright.async_api import async_playwright
        self._pw = await async_playwright().start()
        browser = await self._pw.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled'],
        )
        context = await browser.new_context(
            user_agent=self.rate_limiter.get_random_user_agent(),
            viewport={'width': 1920, 'height': 1080},
            locale='en-GB',
        )
        page = await context.new_page()
        await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf}',
                         lambda route: route.abort())
        return browser, page

    async def _safe_goto(self, page, url, wait_until='domcontentloaded', timeout=30000):
        self.rate_limiter.wait_for_domain(url)
        try:
            await page.goto(url, wait_until=wait_until, timeout=timeout)
        except Exception as e:
            logger.warning(f"Navigation to {url} issue: {e}")
            try:
                await page.goto(url, wait_until='commit', timeout=timeout)
            except Exception:
                raise

    # ──────────────────────────────────────────────────────────────
    # Source configurations
    # ──────────────────────────────────────────────────────────────
    MASTERCARD = {
        'extra_urls': [
            'https://mastercardfdn.org/all/scholars/',
            'https://mastercardfdn.org/scholars/',
        ],
        'heading_keywords': ['scholar', 'program', 'fellow'],
        'provider': 'Mastercard Foundation',
        'provider_type': 'Foundation',
        'tags': ['Comprehensive', 'Leadership'],
        'fallback_key': 'mastercard',
    }

    CHEVENING = {
        'extra_urls': [
            'https://www.chevening.org/scholarship/ghana/',
            'https://www.chevening.org/scholarships/',
        ],
        'heading_keywords': ['chevening', 'scholarship', 'award', 'fellowship'],
        'provider': 'UK Government (FCDO)',
        'provider_type': 'International',
        'tags': ['International', 'UK'],
        'fallback_key': 'chevening',
    }

    STANBIC = {
        'extra_urls': [
            'https://www.stanbicbank.com.gh/ghana/personal/about-us/corporate-social-investment',
            'https://www.stanbicbank.com.gh/',
        ],
        'heading_keywords': ['scholarship', 'future', 'leader', 'bursary', 'graduate'],
        'provider': 'Stanbic Bank Ghana',
        'provider_type': 'Corporate',
        'tags': ['Corporate', 'Business'],
        'fallback_key': 'stanbic',
    }

    DAAD = {
        'extra_urls': [
            'https://www.daad-ghana.org/en/find-funding/',
            'https://www.daad.de/en/studying-in-germany/scholarships/',
        ],
        'heading_keywords': [
            'scholarship', 'funding', 'programme', 'daad', 'grant', 'fellowship',
        ],
        'provider': 'DAAD (German Academic Exchange Service)',
        'provider_type': 'International',
        'tags': ['International', 'Germany'],
        'name_prefix': 'DAAD ',
        'fallback_key': 'daad',
    }

    COMMONWEALTH = {
        'extra_urls': [
            'https://cscuk.fcdo.gov.uk/scholarships/',
            'https://cscuk.fcdo.gov.uk/apply/',
        ],
        'heading_keywords': [
            'scholarship', 'commonwealth', 'fellowship', 'award', 'programme',
        ],
        'provider': 'Commonwealth Scholarship Commission',
        'provider_type': 'International',
        'tags': ['International', 'UK', 'Commonwealth'],
        'fallback_key': 'commonwealth',
    }

    # ──────────────────────────────────────────────────────────────
    # Pipeline
    # ──────────────────────────────────────────────────────────────
    async def _scrape_single_programme(self, *, extra_urls, heading_keywords,
                                       provider, provider_type, tags,
                                       fallback_key, name_prefix='') -> list[dict]:
        browser, page = await self._launch_browser()
        try:
            for url in [self.source.url] + extra_urls:
                try:
                    await self._safe_goto(page, url)
                    await page.wait_for_timeout(3000)
                    html = await page.content()
                except Exception as e:
                    logger.warning(f"{self.source.name} URL {url} failed: {e}")
                    continue
                item = single_item_from_page(
                    html, url,
                    heading_keywords=heading_keywords,
                    provider=provider,
                    provider_type=provider_type,
                    tags=tags,
                    relevance_check=is_relevant_title,
                    name_prefix=name_prefix,
                )
                if item:
                    return [item]
            return self.use_fallback(fallback_key)
        finally:
            await browser.close()
            await self._pw.stop()

    # ──────────────────────────────────────────────────────────────
    # Generic Playwright fallback
    # ──────────────────────────────────────────────────────────────
    async def _scrape_generic_pw(self) -> list[dict]:
        scholarships = []
        browser, page = await self._launch_browser()
        try:
            await self._safe_goto(page, self.source.url)
            await page.wait_for_timeout(3000)
            html = await page.content()

            item = single_item_from_page(
                html, self.source.url,
                heading_keywords=[
                    'scholarship', 'grant', 'bursary', 'award', 'fund',
                    'fellowship', 'opportunity', 'programme',
                ],
                provider=self.source.name,
                provider_type=self.source.provider_type,
                tags=[],
                relevance_check=is_relevant_title,
            )
            if item:
                scholarships.append(item)

        except Exception as e:
            logger.error(f"Generic Playwright scraping failed for {self.source.url}: {e}")
            raise
        finally:
            await browser.close()
            await self._pw.stop()

        return scholarships
