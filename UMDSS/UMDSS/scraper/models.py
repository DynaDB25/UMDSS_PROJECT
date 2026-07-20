from django.db import models

class ScrapingSource(models.Model):
    name = models.CharField(max_length=200)
    url = models.URLField()
    scraper_type = models.CharField(
        max_length=50, 
        choices=[('selenium', 'Selenium'), ('playwright', 'Playwright'), ('generic', 'Generic')]
    )
    provider_type = models.CharField(max_length=20, default='Foundation')
    is_active = models.BooleanField(default=True)
    last_scraped = models.DateTimeField(null=True, blank=True)
    scrape_config = models.JSONField(default=dict, blank=True, help_text='Custom CSS selectors and parsing config per source')
    min_delay = models.FloatField(default=5.0, help_text='Minimum delay in seconds between requests to this source')
    max_delay = models.FloatField(default=10.0, help_text='Maximum delay in seconds between requests to this source')
    consecutive_failures = models.IntegerField(default=0, help_text='Number of consecutive scraping failures')
    cooldown_hours = models.IntegerField(default=6, help_text='Minimum hours between scrapes of this source')
    max_failures_before_cooldown = models.IntegerField(default=3, help_text='Number of failures before triggering a cooldown')
    last_failure_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class ScrapeRun(models.Model):
    source = models.ForeignKey(ScrapingSource, on_delete=models.CASCADE, related_name='runs')
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=50, 
        choices=[('pending', 'Pending'), ('running', 'Running'), ('success', 'Success'), ('failed', 'Failed')], 
        default='pending'
    )
    scholarships_found = models.IntegerField(default=0)
    scholarships_created = models.IntegerField(default=0)
    scholarships_updated = models.IntegerField(default=0)
    error_log = models.TextField(blank=True)

    def __str__(self):
        return f"{self.source.name} - {self.started_at.strftime('%Y-%m-%d %H:%M')}"
