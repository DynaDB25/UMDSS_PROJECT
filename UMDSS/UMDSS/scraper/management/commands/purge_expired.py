"""Delete scholarships whose deadline has already passed.

The Celery beat task that used to do this never runs in production (no worker),
so the daily GitHub Actions workflow calls this instead to keep listings fresh.
Rows with no stated deadline (deadline=None) are kept — "no deadline given" is
not the same as "expired".
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Scholarship


class Command(BaseCommand):
    help = 'Delete scholarships whose deadline is in the past.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        expired = Scholarship.objects.filter(deadline__lt=today)
        count = expired.count()
        expired.delete()
        self.stdout.write(self.style.SUCCESS(
            f"Purged {count} expired scholarship(s). "
            f"{Scholarship.objects.count()} remain."
        ))
