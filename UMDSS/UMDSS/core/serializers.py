from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    StudentProfile, Scholarship, MatchResult,
    Application, VaultDocument, Notification,
)


# ── Auth ──────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'password', 'phone']

    def create(self, validated_data):
        phone = validated_data.pop('phone', '')
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        StudentProfile.objects.create(user=user, phone=phone)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        exclude = ['id', 'user']


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'profile']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        profile = instance.profile
        for attr, value in profile_data.items():
            setattr(profile, attr, value)
        profile.save()
        return instance


# ── Domain ────────────────────────────────────────────

class ScholarshipSerializer(serializers.ModelSerializer):
    id = serializers.SlugField(source='slug')

    class Meta:
        model = Scholarship
        fields = [
            'id', 'name', 'provider', 'provider_type', 'logo_color',
            'initials', 'amount', 'amount_value', 'deadline',
            'region', 'programmes', 'max_aggregate', 'need_based',
            'slots', 'applicants', 'summary', 'benefits', 'documents', 'tags',
            'origin', 'level_scope', 'source_url',
        ]

    def to_representation(self, instance):
        """Return camelCase keys to match the React types"""
        data = super().to_representation(instance)
        return {
            'id': data['id'],
            'name': data['name'],
            'origin': data['origin'],
            'levelScope': data['level_scope'],
            'sourceUrl': data['source_url'],
            'provider': data['provider'],
            'providerType': data['provider_type'],
            'logoColor': data['logo_color'],
            'initials': data['initials'],
            'amount': data['amount'],
            'amountValue': data['amount_value'],
            'deadline': data['deadline'],
            'region': data['region'],
            'programmes': data['programmes'],
            'maxAggregate': data['max_aggregate'],
            'needBased': data['need_based'],
            'slots': data['slots'],
            'applicants': data['applicants'],
            'summary': data['summary'],
            'benefits': data['benefits'],
            'documents': data['documents'],
            'tags': data['tags'],
        }


class MatchResultSerializer(serializers.ModelSerializer):
    scholarship = ScholarshipSerializer()

    class Meta:
        model = MatchResult
        fields = ['scholarship', 'score', 'status', 'criteria']


class ApplicationSerializer(serializers.ModelSerializer):
    # All of these are derived from the linked scholarship or set server-side,
    # so they are read-only. The client only sends scholarship_id (handled in
    # the view), and marking these writable made POST fail validation.
    id = serializers.CharField(source='pk', read_only=True)
    scholarship_id = serializers.SlugField(source='scholarship.slug', read_only=True)
    scholarship_name = serializers.CharField(source='scholarship.name', read_only=True)
    provider = serializers.CharField(source='scholarship.provider', read_only=True)
    initials = serializers.CharField(source='scholarship.initials', read_only=True)
    logo_color = serializers.CharField(source='scholarship.logo_color', read_only=True)
    amount = serializers.CharField(source='scholarship.amount', read_only=True)

    class Meta:
        model = Application
        fields = [
            'id', 'scholarship_id', 'scholarship_name', 'provider',
            'initials', 'logo_color', 'status', 'submitted_on',
            'last_update', 'progress', 'amount', 'timeline',
        ]
        read_only_fields = ['status', 'submitted_on', 'last_update', 'progress', 'timeline']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            'id': f'app-{data["id"]}',
            'scholarshipId': data['scholarship_id'],
            'scholarshipName': data['scholarship_name'],
            'provider': data['provider'],
            'initials': data['initials'],
            'logoColor': data['logo_color'],
            'status': data['status'],
            'submittedOn': data['submitted_on'],
            'lastUpdate': str(data['last_update']),
            'progress': data['progress'],
            'amount': data['amount'],
            'timeline': data['timeline'],
        }


class VaultDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VaultDocument
        fields = [
            'id', 'name', 'file', 'file_type', 'category', 'size',
            'uploaded_on', 'status', 'linked_applications', 'encrypted',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            'id': f'doc-{data["id"]}',
            'name': data['name'],
            'type': data['file_type'],
            'category': data['category'],
            'size': data['size'],
            'uploadedOn': data['uploaded_on'],
            'status': data['status'],
            'linkedApplications': data['linked_applications'],
            'encrypted': data['encrypted'],
            'downloadUrl': f'/api/documents/{instance.id}/download/' if instance.file else None,
        }


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'channel', 'category', 'title', 'body', 'time', 'read']


class AdminStatsSerializer(serializers.Serializer):
    totalScholarships = serializers.IntegerField()
    activeApplicants = serializers.IntegerField()
    applicationsThisCycle = serializers.IntegerField()
    awardsDisbursed = serializers.CharField()


class AdminApplicationSerializer(serializers.Serializer):
    id = serializers.CharField()
    student = serializers.CharField()
    programme = serializers.CharField()
    scholarship = serializers.CharField()
    aggregate = serializers.IntegerField()
    region = serializers.CharField()
    status = serializers.CharField()
