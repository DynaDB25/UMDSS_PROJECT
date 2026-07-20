from django.urls import path
from .views import ScrapingSourceListView, ScrapeRunListView, TriggerScrapeView, TriggerAllScrapeView, ScraperStatsView

urlpatterns = [
    path('sources/', ScrapingSourceListView.as_view(), name='scraper-sources'),
    path('runs/', ScrapeRunListView.as_view(), name='scraper-runs'),
    path('run/<int:source_id>/', TriggerScrapeView.as_view(), name='scraper-trigger'),
    path('run-all/', TriggerAllScrapeView.as_view(), name='scraper-trigger-all'),
    path('stats/', ScraperStatsView.as_view(), name='scraper-stats'),
]
