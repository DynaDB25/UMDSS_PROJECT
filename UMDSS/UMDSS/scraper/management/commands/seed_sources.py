"""Seed / refresh the scraping sources.

Authoritative and idempotent: it rewrites each source's config from this file on
every run (the daily workflow calls it before scraping). For the active API
sources it also re-enables them and clears the failure counter, so a transient
outage that trips the circuit breaker can never permanently disable a source —
the next day's run heals it. Selenium/Playwright sources need a browser the
deployment doesn't have, so they stay inactive; their data is served from the
curated baseline (see seed_scholarships / migration 0007) instead.
"""
from django.core.management.base import BaseCommand
from scraper.models import ScrapingSource


# Reliable, structured feeds (WordPress REST + RSS). These return clean data
# and don't break when a site restyles its pages.
API_SOURCES = [
    {
        'name': 'OpportunityDesk',
        'url': 'https://opportunitydesk.org',
        'provider': 'Foundation',
        'config': {
            'mode': 'wp',
            'endpoints': ['https://opportunitydesk.org/wp-json/wp/v2/posts'],
            'searches': ['scholarship', 'ghana'],
            'per_page': 40,
            'max_items': 35,
            'tags': ['Aggregator', 'International'],
        },
    },
    {
        'name': 'Opportunities For Africans',
        'url': 'https://www.opportunitiesforafricans.com',
        'provider': 'International',
        'config': {
            'mode': 'wp',
            'endpoints': ['https://www.opportunitiesforafricans.com/wp-json/wp/v2/posts'],
            'searches': ['scholarship', 'ghana'],
            'per_page': 40,
            'max_items': 35,
            'tags': ['Africa', 'Aggregator'],
        },
    },
    {
        'name': 'AfterSchool Africa',
        'url': 'https://www.afterschoolafrica.com',
        'provider': 'International',
        'config': {
            'mode': 'wp',
            'endpoints': ['https://www.afterschoolafrica.com/wp-json/wp/v2/posts'],
            'searches': ['scholarship', 'ghana'],
            'per_page': 40,
            'max_items': 35,
            'tags': ['Africa', 'Aggregator'],
        },
    },
    {
        'name': 'Scholars4Dev',
        'url': 'https://www.scholars4dev.com',
        'provider': 'International',
        'config': {
            'mode': 'rss',
            'endpoints': [
                'https://www.scholars4dev.com/category/scholarships-for-african-students/feed/',
                'https://www.scholars4dev.com/category/scholarships-in-africa/feed/',
            ],
            'max_items': 30,
            'tags': ['International', 'Development'],
        },
    },
]

# Ghana-specific providers whose sites are JS-heavy / browser-only and can't be
# scraped on the deployment. Kept as inactive rows for visibility; their
# scholarships come from the curated baseline instead.
INACTIVE_SOURCES = [
    {'name': 'GETFund', 'url': 'https://getfund.gov.gh', 'type': 'selenium', 'provider': 'Government'},
    {'name': 'Ghana Scholarships Secretariat', 'url': 'https://scholarships.gov.gh/', 'type': 'selenium', 'provider': 'Government'},
    {'name': 'MTN Ghana Foundation', 'url': 'https://mtn.com.gh/foundation', 'type': 'selenium', 'provider': 'Corporate'},
    {'name': 'Mastercard Foundation', 'url': 'https://mastercardfdn.org/scholars', 'type': 'playwright', 'provider': 'Foundation'},
    {'name': 'Chevening Scholarships', 'url': 'https://www.chevening.org/scholarship/ghana/', 'type': 'playwright', 'provider': 'International'},
    {'name': 'Stanbic Bank Ghana', 'url': 'https://www.stanbicbank.com.gh/', 'type': 'playwright', 'provider': 'Corporate'},
    {'name': 'DAAD Ghana', 'url': 'https://www.daad-ghana.org', 'type': 'playwright', 'provider': 'International'},
    {'name': 'Commonwealth Scholarships', 'url': 'https://cscuk.fcdo.gov.uk/', 'type': 'playwright', 'provider': 'International'},
]


class Command(BaseCommand):
    help = 'Seed / refresh scraping sources (API sources active, browser sources inactive).'

    def handle(self, *args, **options):
        for s in API_SOURCES:
            ScrapingSource.objects.update_or_create(
                name=s['name'],
                defaults={
                    'url': s['url'],
                    'scraper_type': 'api',
                    'provider_type': s['provider'],
                    'scrape_config': s['config'],
                    'is_active': True,           # force-enable: heals circuit-breaker trips
                    'consecutive_failures': 0,   # reset so yesterday's blip doesn't linger
                    'cooldown_hours': 20,
                    'min_delay': 2.0,
                    'max_delay': 4.0,
                },
            )
            self.stdout.write(self.style.SUCCESS(f"Active API source: {s['name']}"))

        for s in INACTIVE_SOURCES:
            ScrapingSource.objects.update_or_create(
                name=s['name'],
                defaults={
                    'url': s['url'],
                    'scraper_type': s['type'],
                    'provider_type': s['provider'],
                    'is_active': False,
                },
            )
            self.stdout.write(f"Inactive source: {s['name']}")

        active = ScrapingSource.objects.filter(is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f"Done. {active} active source(s)."))
