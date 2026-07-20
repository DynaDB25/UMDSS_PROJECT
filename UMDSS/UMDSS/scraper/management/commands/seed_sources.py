from django.core.management.base import BaseCommand
from scraper.models import ScrapingSource

class Command(BaseCommand):
    help = 'Seed the database with initial scraping sources'

    def handle(self, *args, **options):
        sources = [
            # Original Mock Data Sources
            {'name': 'GETFund', 'url': 'https://getfund.gov.gh', 'type': 'selenium', 'provider': 'Government'},
            {'name': 'Ghana Scholarships Secretariat', 'url': 'https://scholarships.gov.gh/', 'type': 'selenium', 'provider': 'Government'},
            {'name': 'MTN Ghana Foundation', 'url': 'https://mtn.com.gh/foundation', 'type': 'selenium', 'provider': 'Corporate'},
            {'name': 'Mastercard Foundation', 'url': 'https://mastercardfdn.org/scholars', 'type': 'playwright', 'provider': 'Foundation'},
            {'name': 'Chevening Scholarships', 'url': 'https://www.chevening.org/scholarship/ghana/', 'type': 'playwright', 'provider': 'International'},
            {'name': 'Stanbic Bank Ghana', 'url': 'https://www.stanbicbank.com.gh/', 'type': 'playwright', 'provider': 'Corporate'},
            
            # Additional Sources
            {'name': 'DAAD Ghana', 'url': 'https://www.daad-ghana.org', 'type': 'playwright', 'provider': 'International'},
            {'name': 'Commonwealth Scholarships', 'url': 'https://cscuk.fcdo.gov.uk/', 'type': 'playwright', 'provider': 'International'},
            {'name': 'AfricanScholarships.com', 'url': 'https://africanscholarships.com/ghana', 'type': 'generic', 'provider': 'Foundation'},
            {'name': 'OpportunityDesk.org', 'url': 'https://opportunitydesk.org', 'type': 'generic', 'provider': 'Foundation'},
            {'name': 'KNUST Scholarships', 'url': 'https://www.knust.edu.gh/students/scholarships-and-grants', 'type': 'generic', 'provider': 'Government'},
            {'name': 'University of Ghana Scholarships', 'url': 'https://www.ug.edu.gh/financialaid/', 'type': 'generic', 'provider': 'Government'},
            {'name': 'African Union Scholarships', 'url': 'https://au.int/en/scholarship', 'type': 'generic', 'provider': 'International'},
            {'name': 'World Bank Scholarships', 'url': 'https://www.worldbank.org/en/programs/scholarships', 'type': 'generic', 'provider': 'International'},
        ]

        for s in sources:
            obj, created = ScrapingSource.objects.get_or_create(
                name=s['name'],
                defaults={
                    'url': s['url'],
                    'scraper_type': s['type'],
                    'provider_type': s['provider'],
                    'cooldown_hours': 6,
                    'min_delay': 5.0,
                    'max_delay': 10.0,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created source: {obj.name}"))
            else:
                # Update attributes if needed
                obj.url = s['url']
                obj.scraper_type = s['type']
                obj.provider_type = s['provider']
                obj.save()
                self.stdout.write(f"Updated source: {obj.name}")
