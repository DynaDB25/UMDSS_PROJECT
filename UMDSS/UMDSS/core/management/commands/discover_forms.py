"""Find application forms for scholarships that don't have one yet.

The app also does this on demand when a student opens a listing, but running it
in the background (after the daily scrape) means most students never wait for a
crawl. Safe to run repeatedly: rows that already have a link are skipped, and a
fruitless search backs off for a week.
"""
import datetime

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from core.models import Scholarship
from core.form_finder import discover_application_form

RECHECK_AFTER_DAYS = 7


class Command(BaseCommand):
    help = "Discover application form links for scholarships that lack one."

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=40,
                            help='Maximum scholarships to crawl in one run.')
        parser.add_argument('--force', action='store_true',
                            help='Re-check even rows searched recently.')

    def handle(self, *args, **options):
        cutoff = timezone.now() - datetime.timedelta(days=RECHECK_AFTER_DAYS)

        qs = Scholarship.objects.filter(
            application_url='', application_email=''
        ).exclude(source_url='')
        if not options['force']:
            qs = qs.filter(Q(application_checked_at__isnull=True) | Q(application_checked_at__lt=cutoff))

        rows = list(qs[:options['limit']])
        self.stdout.write(f"Checking {len(rows)} scholarship(s) for application forms")

        found = 0
        for s in rows:
            try:
                result = discover_application_form(s.source_url)
            except Exception as exc:
                # Never let one bad page stop the batch.
                self.stdout.write(f"  [error] {s.name[:48]}: {exc}")
                continue

            s.application_url = (result['url'] or '')[:500]
            s.application_email = (result['email'] or '')[:254]
            if result['url'] or result['email']:
                s.application_mode = result['mode']
                found += 1
                target = result['url'] or result['email']
                self.stdout.write(f"  [found] {s.name[:44]}: {target[:70]}")
            else:
                self.stdout.write(f"  [none ] {s.name[:44]}")
            s.application_checked_at = timezone.now()
            s.save(update_fields=[
                'application_url', 'application_email', 'application_mode',
                'application_checked_at',
            ])

        self.stdout.write(f"Done. Found application routes for {found} of {len(rows)}.")
