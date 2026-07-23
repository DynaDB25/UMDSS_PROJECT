from celery import shared_task
from django.utils import timezone
import datetime
import logging
from .models import ScrapingSource
from .scrapers.selenium_scraper import SeleniumScraper
from .scrapers.playwright_scraper import PlaywrightScraper
from .scrapers.generic_scraper import GenericScraper
from .scrapers.api_scraper import ApiScraper
from core.models import Scholarship

logger = logging.getLogger(__name__)

def get_scraper_class(scraper_type):
    if scraper_type == 'selenium':
        return SeleniumScraper
    elif scraper_type == 'playwright':
        return PlaywrightScraper
    elif scraper_type == 'api':
        return ApiScraper
    return GenericScraper

@shared_task(
    bind=True,
    rate_limit='2/m',
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=300,
    time_limit=360
)
def scrape_source(self, source_id):
    try:
        source = ScrapingSource.objects.get(id=source_id, is_active=True)
    except ScrapingSource.DoesNotExist:
        logger.error(f"Source with id {source_id} not found or inactive.")
        return

    logger.info(f"Starting scrape for source: {source.name}")
    try:
        scraper_class = get_scraper_class(source.scraper_type)
        scraper = scraper_class(source)
        scraper.run()
        logger.info(f"Finished scrape for source: {source.name}")
    except Exception as exc:
        logger.error(f"Scrape task failed for {source.name}: {exc}")
        self.retry(exc=exc)

@shared_task
def scrape_with_cooldown(source_id):
    """Checks cooldown before triggering scrape_source."""
    try:
        source = ScrapingSource.objects.get(id=source_id, is_active=True)
        if source.last_scraped:
            cooldown_delta = timezone.timedelta(hours=source.cooldown_hours)
            if timezone.now() - source.last_scraped < cooldown_delta:
                logger.info(f"Source {source.name} is on cooldown. Skipping.")
                return
        scrape_source.delay(source_id)
    except ScrapingSource.DoesNotExist:
        pass

@shared_task
def scrape_all_sources():
    """Trigger scraping for all active sources."""
    sources = ScrapingSource.objects.filter(is_active=True)
    for source in sources:
        scrape_with_cooldown.delay(source.id)

@shared_task
def scrape_by_type(scraper_type):
    """Trigger scraping for active sources of a specific type."""
    sources = ScrapingSource.objects.filter(is_active=True, scraper_type=scraper_type)
    for source in sources:
        scrape_with_cooldown.delay(source.id)

@shared_task
def scrape_staggered():
    """Stagger the triggering of sources to avoid simultaneous spikes."""
    sources = ScrapingSource.objects.filter(is_active=True)
    delay_seconds = 0
    for source in sources:
        scrape_with_cooldown.apply_async(args=[source.id], countdown=delay_seconds)
        delay_seconds += 30

@shared_task
def cleanup_expired_scholarships():
    expired = Scholarship.objects.filter(deadline__lt=datetime.date.today())
    count = expired.count()
    expired.delete()
    logger.info(f"Cleaned up {count} expired scholarships.")
