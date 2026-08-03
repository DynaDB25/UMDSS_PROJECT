import logging
import time
import random
import threading
from urllib.parse import urlparse
from django.utils import timezone

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux i686; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0"
]

class RateLimiter:
    def __init__(self, min_delay=5.0, max_delay=10.0, max_retries=3, backoff_base=30):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self._domain_last_request = {}
        self._lock = threading.Lock()

    def wait_for_domain(self, url):
        domain = urlparse(url).netloc
        
        with self._lock:
            now = time.time()
            if domain in self._domain_last_request:
                elapsed = now - self._domain_last_request[domain]
                delay = random.uniform(self.min_delay, self.max_delay)
                if elapsed < delay:
                    wait_time = delay - elapsed
                    logger.info(f"Rate limiting: Waiting {wait_time:.2f}s for domain {domain}")
                    time.sleep(wait_time)
            
            self._domain_last_request[domain] = time.time()

    def get_random_user_agent(self):
        return random.choice(USER_AGENTS)

    def get_headers(self):
        return {
            'User-Agent': self.get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }

    def should_retry(self, status_code, attempt):
        return status_code in (429, 503) and attempt < self.max_retries

    def get_retry_delay(self, attempt):
        return (self.backoff_base * (2 ** attempt)) + random.uniform(0, 5)

    def handle_response(self, response, attempt=0):
        if self.should_retry(response.status_code, attempt):
            delay = self.get_retry_delay(attempt)
            logger.warning(f"Received {response.status_code}. Retrying in {delay:.2f}s (Attempt {attempt + 1}/{self.max_retries})")
            time.sleep(delay)
            return True
        return False


class CircuitBreaker:
    def __init__(self, max_failures=3):
        self.max_failures = max_failures

    def record_failure(self, source_id):
        from scraper.models import ScrapingSource
        try:
            source = ScrapingSource.objects.get(id=source_id)
            source.consecutive_failures += 1
            source.last_failure_at = timezone.now()
            if source.consecutive_failures >= self.max_failures:
                source.is_active = False
                logger.warning(f"Circuit breaker OPEN for {source.name} (ID: {source_id}). Source disabled.")
            source.save(update_fields=['consecutive_failures', 'is_active', 'last_failure_at'])
        except Exception as e:
            logger.error(f"Failed to record failure for source {source_id}: {e}")

    def record_success(self, source_id):
        from scraper.models import ScrapingSource
        try:
            source = ScrapingSource.objects.get(id=source_id)
            if source.consecutive_failures > 0:
                source.consecutive_failures = 0
                source.save(update_fields=['consecutive_failures'])
        except Exception as e:
            logger.error(f"Failed to record success for source {source_id}: {e}")

    def is_open(self, source_id):
        from scraper.models import ScrapingSource
        try:
            source = ScrapingSource.objects.get(id=source_id)
            return source.consecutive_failures >= self.max_failures
        except Exception:
            return False


class CooldownChecker:
    def should_scrape(self, source):
        if not source.last_scraped:
            return True
        
        cooldown_delta = timezone.timedelta(hours=source.cooldown_hours)
        if timezone.now() - source.last_scraped < cooldown_delta:
            logger.info(f"Source {source.name} is on cooldown. Last scraped: {source.last_scraped}")
            return False
        
        return True
