from django.core.management.base import BaseCommand
from scraper.models import ScrapingSource

class Command(BaseCommand):
    help = 'Seed the database with initial scraping sources'

    def handle(self, *args, **options):
        # 'active' controls whether the scraper cron will try this source.
        # Selenium/Playwright sources need a real browser, which the Render
        # deployment doesn't have, so they are seeded inactive — their data is
        # still served from the curated baseline (see seed_scholarships). Only
        # the lightweight 'generic' (requests + BeautifulSoup) sources run live.
        sources = [
            # Browser-based sources — inactive on Render (no Chrome available).
            {'name': 'GETFund', 'url': 'https://getfund.gov.gh', 'type': 'selenium', 'provider': 'Government', 'active': False},
            {'name': 'Ghana Scholarships Secretariat', 'url': 'https://scholarships.gov.gh/', 'type': 'selenium', 'provider': 'Government', 'active': False},
            {'name': 'MTN Ghana Foundation', 'url': 'https://mtn.com.gh/foundation', 'type': 'selenium', 'provider': 'Corporate', 'active': False},
            {'name': 'Mastercard Foundation', 'url': 'https://mastercardfdn.org/scholars', 'type': 'playwright', 'provider': 'Foundation', 'active': False},
            {'name': 'Chevening Scholarships', 'url': 'https://www.chevening.org/scholarship/ghana/', 'type': 'playwright', 'provider': 'International', 'active': False},
            {'name': 'Stanbic Bank Ghana', 'url': 'https://www.stanbicbank.com.gh/', 'type': 'playwright', 'provider': 'Corporate', 'active': False},
            {'name': 'DAAD Ghana', 'url': 'https://www.daad-ghana.org', 'type': 'playwright', 'provider': 'International', 'active': False},
            {'name': 'Commonwealth Scholarships', 'url': 'https://cscuk.fcdo.gov.uk/', 'type': 'playwright', 'provider': 'International', 'active': False},

            # Lightweight sources — run live on the daily cron.
            {'name': 'AfricanScholarships.com', 'url': 'https://africanscholarships.com/ghana', 'type': 'generic', 'provider': 'Foundation', 'active': True},
            {'name': 'OpportunityDesk.org', 'url': 'https://opportunitydesk.org', 'type': 'generic', 'provider': 'Foundation', 'active': True},
            {'name': 'KNUST Scholarships', 'url': 'https://www.knust.edu.gh/students/scholarships-and-grants', 'type': 'generic', 'provider': 'Government', 'active': True},
            {'name': 'University of Ghana Scholarships', 'url': 'https://www.ug.edu.gh/financialaid/', 'type': 'generic', 'provider': 'Government', 'active': True},
            {'name': 'African Union Scholarships', 'url': 'https://au.int/en/scholarship', 'type': 'generic', 'provider': 'International', 'active': True},
            {'name': 'World Bank Scholarships', 'url': 'https://www.worldbank.org/en/programs/scholarships', 'type': 'generic', 'provider': 'International', 'active': True},
        ]

        for s in sources:
            obj, created = ScrapingSource.objects.get_or_create(
                name=s['name'],
                defaults={
                    'url': s['url'],
                    'scraper_type': s['type'],
                    'provider_type': s['provider'],
                    'is_active': s['active'],
                    'cooldown_hours': 6,
                    'min_delay': 5.0,
                    'max_delay': 10.0,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created source: {obj.name}"))
            else:
                # Keep url/type/provider in sync, but don't stomp an is_active
                # value an admin may have changed deliberately in the UI.
                obj.url = s['url']
                obj.scraper_type = s['type']
                obj.provider_type = s['provider']
                obj.save()
                self.stdout.write(f"Updated source: {obj.name}")
