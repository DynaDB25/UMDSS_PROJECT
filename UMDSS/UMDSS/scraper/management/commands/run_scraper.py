from django.core.management.base import BaseCommand
from scraper.models import ScrapingSource
from scraper.tasks import scrape_source, scrape_all_sources, scrape_by_type

class Command(BaseCommand):
    help = 'Run scrapers manually'

    def add_arguments(self, parser):
        parser.add_argument('--source', type=str, help='Name of the source to scrape')
        parser.add_argument('--type', type=str, choices=['selenium', 'playwright', 'generic'], help='Type of scrapers to run')
        parser.add_argument('--list', action='store_true', help='List all active sources')

    def handle(self, *args, **options):
        if options['list']:
            sources = ScrapingSource.objects.filter(is_active=True)
            self.stdout.write("Active Scraping Sources:")
            for s in sources:
                self.stdout.write(f"- {s.name} ({s.scraper_type})")
            return

        if options['source']:
            try:
                source = ScrapingSource.objects.get(name__icontains=options['source'], is_active=True)
                self.stdout.write(f"Queuing scrape for {source.name}...")
                scrape_source.delay(source.id)
            except ScrapingSource.DoesNotExist:
                self.stderr.write(f"Source matching '{options['source']}' not found.")
            except ScrapingSource.MultipleObjectsReturned:
                self.stderr.write(f"Multiple sources match '{options['source']}'. Please be more specific.")
            return

        if options['type']:
            self.stdout.write(f"Queuing {options['type']} scrapers...")
            scrape_by_type.delay(options['type'])
            return

        self.stdout.write("Queuing all scrapers...")
        scrape_all_sources.delay()
