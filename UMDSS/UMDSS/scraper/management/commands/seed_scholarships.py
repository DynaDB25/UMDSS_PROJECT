"""Load the curated scholarship catalogue straight into the database.

This is the app's baseline. Live scraping (run by the Render Cron Job) only
covers a handful of lightweight sources and can come back empty when a site
changes its markup; without a baseline the whole app would look broken. These
rows are hand-maintained in scraper/scrapers/fallbacks.py and loaded here,
flagged origin='seeded', so Scholarships / Matches always have real data to show.

Idempotent: safe to run on every deploy. Existing rows are updated in place
by slug, so re-running never creates duplicates.
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from core.models import Scholarship
from scraper.scrapers.fallbacks import all_fallbacks


LOGO_COLORS = {
    'Government': 'bg-emerald-600',
    'Corporate': 'bg-amber-500',
    'International': 'bg-indigo-700',
    'Foundation': 'bg-orange-600',
}


def _initials(name: str) -> str:
    return "".join(w[0].upper() for w in name.split() if w and w[0].isalpha())[:4]


def _slug(name: str, provider: str) -> str:
    return slugify(f"{name}-{provider}")[:50]


class Command(BaseCommand):
    help = 'Seed the database with the curated baseline scholarship catalogue.'

    def handle(self, *args, **options):
        created = updated = 0

        for rows in all_fallbacks().values():
            for item in rows:
                provider_type = item.get('provider_type', 'Foundation')
                name = item['name']
                provider = item.get('provider', name)
                slug = _slug(name, provider)

                defaults = {
                    'origin': 'seeded',
                    'source_url': item.get('source_url', ''),
                    'level_scope': item.get('level_scope', 'unknown'),
                    'name': name[:200],
                    'provider': provider[:200],
                    'provider_type': provider_type,
                    'logo_color': LOGO_COLORS.get(provider_type, 'bg-slate-600'),
                    'initials': _initials(name),
                    'amount': (item.get('amount') or 'Variable')[:100],
                    'amount_value': item.get('amount_value', 0),
                    'deadline': item.get('deadline'),
                    'region': item.get('region', ['All']),
                    'programmes': item.get('programmes', ['All']),
                    'max_aggregate': item.get('max_aggregate', 36),
                    'need_based': item.get('need_based', False),
                    'slots': item.get('slots', 0),
                    'summary': item.get('summary', ''),
                    'benefits': item.get('benefits', []),
                    'documents': item.get('documents', []),
                    'tags': item.get('tags', []),
                }

                _, was_created = Scholarship.objects.update_or_create(
                    slug=slug, defaults=defaults,
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded scholarships: {created} created, {updated} updated "
            f"({Scholarship.objects.count()} total)."
        ))

        # Existing users' matches are derived from the scholarship set, so a new
        # catalogue makes them stale. Recompute best-effort; never fail the seed.
        try:
            from core.matching import regenerate_matches_for_user
            from core.models import StudentProfile
            n = 0
            for profile in StudentProfile.objects.select_related('user'):
                regenerate_matches_for_user(profile.user)
                n += 1
            if n:
                self.stdout.write(self.style.SUCCESS(f"Recomputed matches for {n} user(s)."))
        except Exception as exc:  # pragma: no cover - defensive
            self.stderr.write(f"Match regeneration skipped: {exc}")
