from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth import authenticate

from .models import (
    StudentProfile, Scholarship, MatchResult,
    Application, VaultDocument, Notification,
)
from .serializers import (
    RegisterSerializer, UserSerializer, ScholarshipSerializer,
    MatchResultSerializer, ApplicationSerializer,
    VaultDocumentSerializer, NotificationSerializer,
    AdminStatsSerializer, AdminApplicationSerializer,
)


# ── Auth ──────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/  → create user + profile, return tokens"""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login/  → authenticate, return tokens"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        password = request.data.get('password', '')

        # Django authenticate uses username, our users' username == email
        user = authenticate(username=email, password=password)
        if user is None:
            return Response(
                {'detail': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        })


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PUT /api/auth/me/  → read or update current user + profile"""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        from .matching import regenerate_matches_for_user
        serializer.save()
        # Matches are derived from the profile, so a profile edit invalidates
        # them; recompute immediately rather than trusting a manual command.
        regenerate_matches_for_user(self.request.user)


# ── Scholarships ──────────────────────────────────────

class ScholarshipViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Scholarship.objects.all()
    serializer_class = ScholarshipSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'


# ── Matches ───────────────────────────────────────────

class MatchListView(generics.ListAPIView):
    """GET /api/matches/  → matches for the logged-in user"""
    serializer_class = MatchResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MatchResult.objects.filter(
            student=self.request.user
        ).select_related('scholarship')


# ── Applications ──────────────────────────────────────

class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Application.objects.filter(
            student=self.request.user
        ).select_related('scholarship')

    def perform_create(self, serializer):
        scholarship_slug = self.request.data.get('scholarship_id')
        scholarship = Scholarship.objects.get(slug=scholarship_slug)
        serializer.save(student=self.request.user, scholarship=scholarship)


# ── Vault Documents ───────────────────────────────────

from rest_framework.decorators import action
from django.http import HttpResponse
from django.conf import settings
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os
import datetime
from django.core.files.base import ContentFile

class VaultDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = VaultDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return VaultDocument.objects.filter(student=self.request.user)

    def perform_create(self, serializer):
        # Encrypt the file before saving
        file_obj = self.request.FILES.get('file')
        size_str = ""
        file_type = "PDF"
        if file_obj:
            # Basic size calculation
            mb = file_obj.size / (1024 * 1024)
            size_str = f"{mb:.1f} MB" if mb >= 1 else f"{file_obj.size / 1024:.0f} KB"
            ext = os.path.splitext(file_obj.name)[1].upper().replace('.', '')
            file_type = ext if ext else "FILE"

            # AES-256-GCM Encryption
            key = base64.urlsafe_b64decode(settings.VAULT_ENCRYPTION_KEY)
            aesgcm = AESGCM(key)
            nonce = os.urandom(12)
            raw_data = file_obj.read()
            encrypted_data = aesgcm.encrypt(nonce, raw_data, None)
            
            # Combine nonce and ciphertext
            secure_data = nonce + encrypted_data
            
            encrypted_file = ContentFile(secure_data)
            encrypted_file.name = file_obj.name + ".enc"
            
            # Update the serializer with the encrypted file
            serializer.validated_data['file'] = encrypted_file

        serializer.save(
            student=self.request.user,
            size=size_str,
            file_type=file_type,
            uploaded_on=datetime.date.today().strftime('%b %d, %Y'),
            status='Verified',  # Auto-verify for demonstration
            encrypted=True
        )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.file:
            return Response({'error': 'No file attached'}, status=404)

        try:
            with document.file.open('rb') as f:
                secure_data = f.read()

            # Decrypt the file
            key = base64.urlsafe_b64decode(settings.VAULT_ENCRYPTION_KEY)
            aesgcm = AESGCM(key)
            
            nonce = secure_data[:12]
            ciphertext = secure_data[12:]
            
            decrypted_data = aesgcm.decrypt(nonce, ciphertext, None)
            
            response = HttpResponse(decrypted_data, content_type='application/octet-stream')
            original_name = document.file.name.replace('vault_documents/', '').replace('.enc', '')
            response['Content-Disposition'] = f'attachment; filename="{original_name}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ── Notifications ─────────────────────────────────────

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(student=self.request.user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_all_read(request):
    """POST /api/notifications/mark-all-read/ → mark all as read"""
    Notification.objects.filter(student=request.user, read=False).update(read=True)
    return Response({'detail': 'All notifications marked as read.'})


# ── Admin ─────────────────────────────────────────────

class AdminStatsView(APIView):
    """GET /api/admin/stats/ → aggregate stats for the admin dashboard"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        total_scholarships = Scholarship.objects.count()
        active_applicants = User.objects.filter(applications__isnull=False).distinct().count()
        total_applications = Application.objects.count()

        # Sum of scholarship amounts for awarded applications
        from django.db.models import Sum
        total_awarded = Application.objects.filter(
            status='Awarded'
        ).aggregate(total=Sum('scholarship__amount_value'))['total'] or 0

        data = {
            'totalScholarships': total_scholarships,
            'activeApplicants': active_applicants,
            'applicationsThisCycle': total_applications,
            'awardsDisbursed': f'GH₵ {total_awarded / 1_000_000:.1f}M' if total_awarded >= 1_000_000 else f'GH₵ {total_awarded:,}',
        }
        return Response(data)


class AdminApplicationsView(generics.ListAPIView):
    """GET /api/admin/applications/ → all applications for admin table"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AdminApplicationSerializer

    def get_queryset(self):
        return Application.objects.select_related(
            'student', 'student__profile', 'scholarship'
        ).all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = []
        for app in qs:
            profile = getattr(app.student, 'profile', None)
            data.append({
                'id': f'KN-{10293 + app.pk}',
                'student': app.student.get_full_name(),
                'programme': profile.programme if profile else '',
                'scholarship': app.scholarship.name,
                'aggregate': profile.wassce_aggregate if profile else 0,
                'region': profile.region if profile else '',
                'status': app.status,
            })
        return Response(data)


# ── Reference data ────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def reference_data(request):
    """GET /api/reference/ → regions, programmes etc."""
    return Response({
        'regions': [
            'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
            'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
            'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
        ],
        'programmes': [
            'BSc Computer Engineering', 'BSc Computer Science', 'BSc Electrical Engineering',
            'BSc Mechanical Engineering', 'BSc Civil Engineering', 'BSc Biochemistry',
            'BSc Nursing', 'Doctor of Medicine', 'BSc Agriculture', 'BA Economics',
            'BSc Business Administration', 'LLB Law', 'BSc Mathematics', 'BSc Physics',
        ],
    })
