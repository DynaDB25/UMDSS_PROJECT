from rest_framework import serializers
from .models import ScrapingSource, ScrapeRun

class ScrapingSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapingSource
        fields = '__all__'

class ScrapeRunSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    
    class Meta:
        model = ScrapeRun
        fields = '__all__'
