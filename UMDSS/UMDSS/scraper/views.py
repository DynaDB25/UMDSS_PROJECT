import threading

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import ScrapingSource, ScrapeRun
from .serializers import ScrapingSourceSerializer, ScrapeRunSerializer
from .tasks import get_scraper_class
from django.db.models import Sum


def _scrape_in_background(source_ids):
    """Run scrapers for the given source ids off the request thread.

    There is no Celery worker in production (CELERY_TASK_ALWAYS_EAGER=True), so
    calling a task's .delay() would run the whole scrape inside the HTTP request
    and time the web worker out. A daemon thread lets the endpoint respond
    immediately; BaseScraper.run() handles its own errors and records a ScrapeRun.
    """
    def worker():
        from django.db import connection
        for sid in source_ids:
            try:
                source = ScrapingSource.objects.get(id=sid, is_active=True)
                get_scraper_class(source.scraper_type)(source).run()
            except Exception:  # never let a background thread crash silently take down others
                import logging
                logging.getLogger('scraper').exception(f"Background scrape failed for source {sid}")
        connection.close()  # don't leak the thread's DB connection

    threading.Thread(target=worker, daemon=True).start()

class ScrapingSourceListView(generics.ListAPIView):
    queryset = ScrapingSource.objects.all()
    serializer_class = ScrapingSourceSerializer
    permission_classes = [permissions.IsAuthenticated]

class ScrapeRunListView(generics.ListAPIView):
    queryset = ScrapeRun.objects.select_related('source').order_by('-started_at')
    serializer_class = ScrapeRunSerializer
    permission_classes = [permissions.IsAuthenticated]

class TriggerScrapeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, source_id):
        try:
            source = ScrapingSource.objects.get(id=source_id, is_active=True)
        except ScrapingSource.DoesNotExist:
            return Response({'detail': 'Source not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        _scrape_in_background([source.id])
        return Response({'detail': f'Scraping started for {source.name}'}, status=status.HTTP_202_ACCEPTED)

class TriggerAllScrapeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ids = list(ScrapingSource.objects.filter(is_active=True).values_list('id', flat=True))
        _scrape_in_background(ids)
        return Response(
            {'detail': f'Scraping started for {len(ids)} active source(s)'},
            status=status.HTTP_202_ACCEPTED,
        )

class ScraperStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        total_sources = ScrapingSource.objects.count()
        active_sources = ScrapingSource.objects.filter(is_active=True).count()
        runs_today = ScrapeRun.objects.filter(started_at__date=timezone.now().date()).count()
        
        totals = ScrapeRun.objects.aggregate(
            found=Sum('scholarships_found'),
            created=Sum('scholarships_created'),
            updated=Sum('scholarships_updated')
        )
        
        return Response({
            'totalSources': total_sources,
            'activeSources': active_sources,
            'runsToday': runs_today,
            'scholarshipsFound': totals['found'] or 0,
            'scholarshipsCreated': totals['created'] or 0,
            'scholarshipsUpdated': totals['updated'] or 0,
        })
