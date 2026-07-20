from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import ScrapingSource, ScrapeRun
from .serializers import ScrapingSourceSerializer, ScrapeRunSerializer
from .tasks import scrape_source, scrape_all_sources
from django.db.models import Sum

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
            scrape_source.delay(source.id)
            return Response({'detail': f'Scraping triggered for {source.name}'})
        except ScrapingSource.DoesNotExist:
            return Response({'detail': 'Source not found or inactive'}, status=status.HTTP_404_NOT_FOUND)

class TriggerAllScrapeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        scrape_all_sources.delay()
        return Response({'detail': 'Scraping triggered for all active sources'})

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
