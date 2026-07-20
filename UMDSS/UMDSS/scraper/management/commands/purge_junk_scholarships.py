from django.core.management.base import BaseCommand
from core.models import Scholarship
from scraper.scrapers.base import is_relevant_title


class Command(BaseCommand):
    help = 'Remove scraped rows that are site chrome (cookie banners, nav) rather than scholarships.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Actually delete. Without this the command only reports what it would remove.',
        )

    def handle(self, *args, **options):
        # Only scraped rows are parsed out of HTML, so only they can be junk.
        # Seeded and curated rows are hand-written and some legitimately carry no
        # scholarship keyword ("Stanbic Bank Future Leaders").
        junk = [
            s for s in Scholarship.objects.filter(origin='scraped')
            if not is_relevant_title(s.name)
        ]

        if not junk:
            self.stdout.write(self.style.SUCCESS('No junk rows found.'))
            return

        self.stdout.write(f'Found {len(junk)} junk row(s) of {Scholarship.objects.count()} total:')
        for s in junk:
            self.stdout.write(f'  - {s.name[:60]}  ({s.provider[:25]})')

        if not options['apply']:
            self.stdout.write(self.style.WARNING('\nDry run. Re-run with --apply to delete.'))
            return

        # delete() reports cascaded rows (match results) too, so count the
        # scholarships themselves rather than the total.
        Scholarship.objects.filter(id__in=[s.id for s in junk]).delete()
        self.stdout.write(self.style.SUCCESS(f'\nDeleted {len(junk)} junk scholarship(s).'))
        self.stdout.write(f'Remaining: {Scholarship.objects.count()}')
