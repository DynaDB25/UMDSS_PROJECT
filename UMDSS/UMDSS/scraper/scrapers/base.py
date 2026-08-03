import logging
import datetime
import re
from django.utils.text import slugify
from django.utils import timezone
from core.models import Scholarship
from scraper.models import ScrapeRun
from .rate_limiter import RateLimiter, CircuitBreaker, CooldownChecker

logger = logging.getLogger(__name__)


class NoRelevantResultsError(Exception):
    """Raised when a scrape yields nothing that looks like a scholarship."""


class FallbackOnlyError(Exception):
    """Raised when the live scrape produced nothing and curated data was substituted.

    The curated rows are still saved (flagged origin='curated') so the app keeps a
    baseline, but the run is a failure: nothing was actually confirmed against the
    live site.
    """


# Site chrome: consent banners, nav, and section headings that are never scholarships.
JUNK_TITLE_RE = re.compile(
    r'cookie|consent|privacy|preference|newsletter|subscribe|google analytics|'
    r'php session|page not found|404|navigation|quick.?links|latest news|'
    r'latest publications|sign in|log in|follow us|our channels|notifications|'
    r'advertisement|my guide|offers & services|ways to bank|top header|'
    r'contribution to|our development impact|admission requirements|'
    r'alumni services|alumni profiles|finding scholarships|conferences & training|'
    r'^(opportunities|competitions|fellowships|scholarships|announcements|contact|about .*)$',
    re.I,
)

# A title must carry at least one of these to be treated as a funding opportunity.
SCHOLARSHIP_SIGNAL_RE = re.compile(
    r'scholarship|scholars|bursar|fellowship|grant|award|stipend|'
    r'financial aid|scheme|programme|program',
    re.I,
)


def is_relevant_title(name: str) -> bool:
    """True if a scraped title plausibly names a funding opportunity.

    Scrapers key off generic container classes, so consent dialogs and nav
    headings reach this point looking like results. Title text is the only
    field consistently populated across sources, so it is the gate.
    """
    name = (name or '').strip()
    if len(name) < 10:
        return False
    if JUNK_TITLE_RE.search(name):
        return False
    # Real scholarship titles are short. Anything this long is a sentence the
    # parser lifted out of a paragraph, not a heading.
    if len(name.split()) > 14:
        return False
    # Roundup articles ("13 Global Scholarships ... Currently Open - July 9")
    # list many opportunities; the article itself is not a scholarship.
    if re.match(r'^\d+\s', name) and 'currently open' in name.lower():
        return False
    return bool(SCHOLARSHIP_SIGNAL_RE.search(name))


class BaseScraper:
    """Base class for all scholarship scrapers.

    Provides rate limiting, circuit breaking, cooldown checks,
    data normalization, and save logic. Subclasses must implement scrape().
    """

    def __init__(self, source):
        self.source = source
        self.run_record = None
        # Set by a subclass when it substitutes hardcoded "known data" because the
        # live scrape came back empty. Fallback only fires when nothing was scraped,
        # so it taints the whole result set, not individual items.
        self._used_fallback = False
        self.rate_limiter = RateLimiter(
            min_delay=source.min_delay,
            max_delay=source.max_delay,
        )
        self.circuit_breaker = CircuitBreaker(
            max_failures=source.max_failures_before_cooldown
        )
        self.cooldown_checker = CooldownChecker()

    def scrape(self) -> list[dict]:
        """Must return a list of dicts with scholarship data.
        
        Each dict should contain as many of these keys as possible:
        - name (required): Scholarship name
        - provider: Organization providing the scholarship
        - provider_type: 'Government', 'Corporate', 'International', 'Foundation'
        - amount: Human-readable amount string
        - amount_value: Numeric annual value in GHS
        - deadline: date object or ISO string
        - region: list of eligible regions, or ['All']
        - programmes: list of eligible programmes, or ['All']
        - max_aggregate: maximum WASSCE aggregate (lower = stricter)
        - need_based: boolean
        - slots: number of available slots
        - summary: description text
        - benefits: list of benefit strings
        - documents: list of required document names
        - tags: list of tag strings
        - source_url: URL where this scholarship was found
        """
        raise NotImplementedError("Subclasses must implement scrape()")

    def is_relevant(self, item: dict) -> bool:
        return is_relevant_title(item.get('name'))

    def use_fallback(self, key: str) -> list[dict]:
        """Return the curated fallback rows for this source and taint the run.

        Callers use this when the live scrape produced nothing relevant. The
        rows come from fallbacks.py (single hand-maintained catalogue) and the
        run will be marked failed by run()'s FallbackOnlyError path.
        """
        from .fallbacks import all_fallbacks
        self._used_fallback = True
        logger.info(f"{self.source.name}: live scrape empty — using curated fallback '{key}'")
        return all_fallbacks()[key]

    def filter_relevant(self, data: list[dict]) -> list[dict]:
        kept = []
        for item in data:
            if self.is_relevant(item):
                kept.append(item)
            else:
                logger.debug(f"Rejected non-scholarship item: {item.get('name')!r}")
        rejected = len(data) - len(kept)
        if rejected:
            logger.info(
                f"{self.source.name}: filtered out {rejected} non-scholarship "
                f"item(s) of {len(data)} scraped."
            )
        return kept

    def normalize_scholarship(self, item: dict) -> dict:
        """Normalize raw scraped data into the standard schema.
        
        Fills in defaults, cleans strings, and ensures type correctness.
        """
        name = (item.get('name') or 'Unknown Scholarship').strip()
        provider = (item.get('provider') or self.source.name).strip()
        provider_type = item.get('provider_type', self.source.provider_type)

        # Parse deadline. None is a legitimate value — it means the source
        # never stated one, and inventing "today + N days" here is exactly the
        # fabrication that made stale listings look current.
        deadline = item.get('deadline')
        if isinstance(deadline, str):
            try:
                deadline = datetime.date.fromisoformat(deadline)
            except (ValueError, TypeError):
                deadline = None
        if not isinstance(deadline, datetime.date):
            deadline = None

        # Parse amount_value from amount string if not provided
        amount_value = item.get('amount_value', 0)
        amount_str = item.get('amount', 'Variable')
        if amount_value == 0 and amount_str:
            amount_value = self._extract_amount_value(amount_str)

        # Ensure list fields
        region = item.get('region', ['All'])
        if isinstance(region, str):
            region = [region] if region else ['All']

        programmes = item.get('programmes', ['All'])
        if isinstance(programmes, str):
            programmes = [programmes] if programmes else ['All']

        benefits = item.get('benefits', [])
        if isinstance(benefits, str):
            benefits = [benefits]

        documents = item.get('documents', [])
        if isinstance(documents, str):
            documents = [documents]

        tags = item.get('tags', [])
        if isinstance(tags, str):
            tags = [tags]

        # Only trust an explicit classification; scraped pages rarely state one.
        level_scope = item.get('level_scope', 'unknown')

        return {
            'source_url': (item.get('source_url') or '')[:500],
            'name': name[:200],
            'provider': provider[:200],
            'provider_type': provider_type,
            'level_scope': level_scope,
            'amount': (amount_str or 'Variable')[:100],
            'amount_value': amount_value,
            'deadline': deadline,
            'region': region,
            'programmes': programmes,
            'max_aggregate': item.get('max_aggregate', 36),
            'need_based': item.get('need_based', False),
            'slots': item.get('slots', 0),
            'summary': (item.get('summary') or '')[:2000],
            'benefits': benefits,
            'documents': documents,
            'tags': tags,
        }

    @staticmethod
    def _extract_amount_value(amount_str: str) -> int:
        """Try to extract a numeric value from an amount string like 'GH₵ 10,000 / year'."""
        if not amount_str:
            return 0
        # Remove currency symbols and common words
        cleaned = amount_str.replace('GH₵', '').replace('GHS', '').replace('$', '')
        cleaned = cleaned.replace(',', '').replace(' ', '')
        # Find first number
        match = re.search(r'(\d+(?:\.\d+)?)', cleaned)
        if match:
            try:
                return int(float(match.group(1)))
            except (ValueError, TypeError):
                pass
        return 0

    def save_scholarships(self, data: list[dict]):
        """Normalize and save/update scholarships in the database."""
        created_count = 0
        updated_count = 0
        for item in data:
            try:
                normalized = self.normalize_scholarship(item)
                slug = self.generate_slug(normalized['name'], normalized['provider'])
                defaults = {
                    'origin': 'curated' if self._used_fallback else 'scraped',
                    'source_url': normalized['source_url'],
                    'level_scope': normalized['level_scope'],
                    'name': normalized['name'],
                    'provider': normalized['provider'],
                    'provider_type': normalized['provider_type'],
                    'logo_color': self.assign_logo_color(normalized['provider_type']),
                    'initials': self.generate_initials(normalized['name']),
                    'amount': normalized['amount'],
                    'amount_value': normalized['amount_value'],
                    'deadline': normalized['deadline'],
                    'region': normalized['region'],
                    'programmes': normalized['programmes'],
                    'max_aggregate': normalized['max_aggregate'],
                    'need_based': normalized['need_based'],
                    'slots': normalized['slots'],
                    'summary': normalized['summary'],
                    'benefits': normalized['benefits'],
                    'documents': normalized['documents'],
                    'tags': normalized['tags'],
                }

                exists = Scholarship.objects.filter(slug=slug).exists()
                Scholarship.objects.update_or_create(slug=slug, defaults=defaults)

                if exists:
                    updated_count += 1
                else:
                    created_count += 1
            except Exception as e:
                logger.error(f"Error saving scholarship {item.get('name')}: {e}")
                if self.run_record:
                    self.run_record.error_log += f"Error saving {item.get('name')}: {e}\n"

        return created_count, updated_count

    def run(self):
        """Execute the full scraping pipeline with safety checks."""
        source_id = self.source.id

        # Circuit breaker check
        if self.circuit_breaker.is_open(source_id):
            logger.warning(f"Circuit breaker OPEN for {self.source.name} — skipping.")
            return

        # Cooldown check
        if not self.cooldown_checker.should_scrape(self.source):
            logger.info(f"Cooldown active for {self.source.name} — skipping.")
            return

        self.run_record = ScrapeRun.objects.create(source=self.source, status='running')
        try:
            raw = self.scrape()
            # The relevance gate exists to catch junk parsed out of HTML. Curated
            # fallback entries are hand-written and trusted by construction — some
            # have no keyword in the title ("Chevening-Ghana Undergraduate Link")
            # and would be wrongly rejected.
            data = raw if self._used_fallback else self.filter_relevant(raw)
            self.run_record.scholarships_found = len(data)

            if not data:
                raise NoRelevantResultsError(
                    f"Scraped {len(raw)} item(s) but none looked like a scholarship. "
                    f"Selectors for this source are likely stale."
                )

            # Save before the fallback check so curated rows still land in the DB,
            # flagged as unverified.
            created, updated = self.save_scholarships(data)
            self.run_record.scholarships_created = created
            self.run_record.scholarships_updated = updated

            if self._used_fallback:
                raise FallbackOnlyError(
                    f"Live scrape returned nothing; served {len(data)} curated "
                    f"fallback row(s) instead. Their amounts and deadlines are not "
                    f"confirmed against the live site."
                )

            self.run_record.status = 'success'
            self.circuit_breaker.record_success(source_id)
            logger.info(
                f"Scrape SUCCESS for {self.source.name}: "
                f"scraped={len(raw)}, relevant={len(data)}, "
                f"created={created}, updated={updated}"
            )
        except Exception as e:
            logger.exception(f"Scraper FAILED for {self.source.name}")
            self.run_record.error_log += str(e)
            self.run_record.status = 'failed'
            self.circuit_breaker.record_failure(source_id)
        finally:
            self.run_record.finished_at = timezone.now()
            self.run_record.save()
            self.source.last_scraped = timezone.now()
            self.source.save(update_fields=['last_scraped'])
            # Scholarship rows may have changed (even a fallback run saves
            # curated rows), so stored matches are stale until recomputed.
            self._refresh_matches()

    def _refresh_matches(self):
        from core.matching import regenerate_matches_for_user
        from core.models import StudentProfile
        try:
            for profile in StudentProfile.objects.select_related('user'):
                regenerate_matches_for_user(profile.user)
        except Exception:
            logger.exception('Match regeneration after scrape failed')

    @staticmethod
    def generate_slug(name, provider):
        return slugify(f"{name}-{provider}")[:50]

    @staticmethod
    def generate_initials(name):
        words = name.split()
        return "".join([w[0].upper() for w in words if w and w[0].isalpha()])[:4]

    @staticmethod
    def assign_logo_color(provider_type):
        colors = {
            'Government': 'bg-emerald-600',
            'Corporate': 'bg-amber-500',
            'International': 'bg-indigo-700',
            'Foundation': 'bg-orange-600',
        }
        return colors.get(provider_type, 'bg-slate-600')
