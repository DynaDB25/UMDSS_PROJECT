from django.contrib import admin
from .models import ScrapingSource, ScrapeRun

@admin.register(ScrapingSource)
class ScrapingSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'scraper_type', 'is_active', 'last_scraped')
    list_filter = ('scraper_type', 'is_active')
    search_fields = ('name', 'url')

@admin.register(ScrapeRun)
class ScrapeRunAdmin(admin.ModelAdmin):
    list_display = ('source', 'status', 'started_at', 'scholarships_found')
    list_filter = ('status', 'source')
    search_fields = ('source__name',)
