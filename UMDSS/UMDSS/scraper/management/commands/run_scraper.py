"""Run scrapers synchronously — the entry point for the Render Cron Job.

Deliberately does NOT go through Celery. The project runs with
CELERY_TASK_ALWAYS_EAGER and no worker/broker in production, so `.delay()`
would execute inline anyway but drag in the task's retry machinery (which
re-raises on failure and can abort the whole run). Calling the scraper
directly is simpler and each source is isolated: one failing site never stops
the others. BaseScraper.run() records a ScrapeRun row and handles its own
errors, so this command just drives it.

Usage:
    python manage.py run_scraper                 # all active lightweight sources
    python manage.py run_scraper --source knust  # one source by name
    python manage.py run_scraper --type generic  # every active source of a type
    python manage.py run_scraper --all           # include browser-based sources too
    python manage.py run_scraper --list          # list active sources
"""
from django.core.management.base import BaseCommand

from scraper.models import ScrapingSource
from scraper.tasks import get_scraper_class

# Sources of these types need a real browser, which the Render deployment
# doesn't have. Skip them unless explicitly asked for with --all.
BROWSER_TYPES = {'selenium', 'playwright'}


class Command(BaseCommand):
    help = 'Run scrapers synchronously (used by the daily cron job).'

    def add_arguments(self, parser):
        parser.add_argument('--source', type=str, help='Scrape one source by (partial) name')
        parser.add_argument('--type', type=str, choices=['api', 'generic', 'selenium', 'playwright'],
                            help='Scrape every active source of this type')
        parser.add_argument('--all', action='store_true',
                            help='Include browser-based (selenium/playwright) sources')
        parser.add_argument('--list', action='store_true', help='List active sources and exit')

    def handle(self, *args, **options):
        if options['list']:
            self.stdout.write("Active scraping sources:")
            for s in ScrapingSource.objects.filter(is_active=True).order_by('name'):
                self.stdout.write(f"  - {s.name} ({s.scraper_type})")
            return

        if options['source']:
            try:
                source = ScrapingSource.objects.get(
                    name__icontains=options['source'], is_active=True,
                )
            except ScrapingSource.DoesNotExist:
                self.stderr.write(f"No active source matching '{options['source']}'.")
                return
            except ScrapingSource.MultipleObjectsReturned:
                self.stderr.write(f"Multiple sources match '{options['source']}'. Be more specific.")
                return
            self._run_one(source)
            return

        sources = ScrapingSource.objects.filter(is_active=True)
        if options['type']:
            sources = sources.filter(scraper_type=options['type'])
        elif not options['all']:
            sources = sources.exclude(scraper_type__in=BROWSER_TYPES)

        sources = list(sources.order_by('name'))
        if not sources:
            self.stdout.write("No matching active sources to scrape.")
            return

        self.stdout.write(f"Scraping {len(sources)} source(s)...")
        ok = failed = 0
        for source in sources:
            if self._run_one(source):
                ok += 1
            else:
                failed += 1
        self.stdout.write(self.style.SUCCESS(f"Done. {ok} succeeded, {failed} failed."))

    def _run_one(self, source) -> bool:
        """Run a single source. Returns True on success. Never raises."""
        self.stdout.write(f"-> {source.name} ({source.scraper_type})")
        try:
            scraper = get_scraper_class(source.scraper_type)(source)
            scraper.run()
        except Exception as exc:  # BaseScraper.run() catches its own errors;
            # this guards against construction/import failures (e.g. a browser
            # driver missing for a selenium source run with --all).
            self.stderr.write(self.style.ERROR(f"   {source.name} crashed: {exc}"))
            return False

        run = source.runs.order_by('-started_at').first()
        if run and run.status == 'success':
            self.stdout.write(self.style.SUCCESS(
                f"   OK found={run.scholarships_found} "
                f"created={run.scholarships_created} updated={run.scholarships_updated}"
            ))
            return True
        detail = f" - {run.error_log.strip()[:200]}" if run and run.error_log else ""
        self.stdout.write(self.style.WARNING(f"   FAILED {run.status if run else 'no run'}{detail}"))
        return False
