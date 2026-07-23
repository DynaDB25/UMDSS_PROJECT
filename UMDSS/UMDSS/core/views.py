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


class ChangePasswordView(APIView):
    """POST /api/auth/password/  → change the logged-in user's password."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password', '')
        new = request.data.get('new_password', '')
        if not request.user.check_password(current):
            return Response({'detail': 'Your current password is incorrect.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(new) < 8:
            return Response({'detail': 'New password must be at least 8 characters.'},
                            status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new)
        request.user.save()
        return Response({'detail': 'Password updated successfully.'})


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

    def create(self, request, *args, **kwargs):
        import datetime
        slug = request.data.get('scholarship_id')
        if not slug:
            return Response({'detail': 'scholarship_id is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            scholarship = Scholarship.objects.get(slug=slug)
        except Scholarship.DoesNotExist:
            return Response({'detail': 'That scholarship no longer exists.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Applying twice is a no-op: return the existing application instead of
        # erroring, so the UI can just route the student to their tracker.
        existing = Application.objects.filter(
            student=request.user, scholarship=scholarship).first()
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        today = datetime.date.today().strftime('%b %d, %Y')
        app = Application.objects.create(
            student=request.user,
            scholarship=scholarship,
            status='Submitted',
            submitted_on=today,
            progress=25,
            timeline=[
                {'label': 'Application started', 'date': today, 'done': True},
                {'label': 'Submitted', 'date': today, 'done': True},
                {'label': 'Under review', 'date': 'Pending', 'done': False},
                {'label': 'Decision', 'date': 'Pending', 'done': False},
            ],
        )
        Notification.objects.create(
            student=request.user,
            channel='System',
            category='Status',
            title=f'Application submitted: {scholarship.name}',
            body=f'Your application to {scholarship.provider} has been received and is now with the review team.',
            time='Just now',
        )
        return Response(self.get_serializer(app).data, status=status.HTTP_201_CREATED)


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


# ── AI Assistant (Groq) ───────────────────────────────

import logging

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

# Groq's flagship open-weight reasoning model (Kimi K2 and Llama 4 Scout were
# deprecated in favour of this in 2026). Overridable so we can swap models
# without a code change.
DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

ASSISTANT_SYSTEM = (
    "You are the ScholarCircle Decision Bot, an expert, warm and practical adviser who helps "
    "Ghanaian students find, win and manage scholarships. You compare awards, check eligibility, "
    "plan deadlines, write and sharpen essays, personal statements and motivation letters, and run "
    "world-class interview preparation.\n\n"

    "VOICE (write like a real human mentor, never like a chatbot):\n"
    "- Sound like a sharp, encouraging Ghanaian mentor talking to a student. Warm, direct, specific.\n"
    "- Vary your sentence length. Mix short punchy lines with longer ones so it reads naturally.\n"
    "- Never use em dashes or en dashes. Use commas, full stops, colons, brackets or the word 'and' "
    "instead. This is a hard rule.\n"
    "- Ban AI filler and cliches: no 'in today's fast-paced world', 'it is important to note', "
    "'delve', 'tapestry', 'navigate the landscape', 'unlock your potential', 'leverage', 'moreover', "
    "'furthermore', 'embark on a journey'. Just say the thing plainly.\n"
    "- Do not over-hedge or pad. Every sentence should earn its place.\n\n"

    "ACCURACY:\n"
    "- Ground every answer in the STUDENT DATA below. Never invent scholarships, amounts, deadlines "
    "or eligibility rules that are not in that data. If something isn't there, say so plainly and "
    "point the student to the Scholarships or Matches page.\n"
    "- Money is in Ghana Cedis (GH₵); use Ghanaian/UK date style (day month year).\n"
    "- Listings flagged UNVERIFIED may be out of date, so tell the student to confirm those details "
    "on the provider's official website before relying on them.\n"
    "- You are not a lawyer or a licensed financial adviser; for legal or financial specifics, tell "
    "the student to confirm with the provider or a qualified professional.\n\n"

    "WRITING DOCUMENTS (essays, personal statements, motivation letters, cover letters, CVs):\n"
    "- Write in the student's own authentic voice, grounded in their real profile, programme, region "
    "and goals. Make it specific and personal, not generic.\n"
    "- If you are missing details that would make the piece strong (their story, achievements, "
    "challenges overcome, career goal, why this funder), either ask 2 to 3 sharp questions first, or "
    "write a strong full draft and mark anything you had to assume with [square brackets] for them to "
    "confirm or replace.\n"
    "- Match the length and format the scholarship expects. Write documents as flowing prose in real "
    "paragraphs, not bullet points. Give them a clear title line.\n"
    "- After delivering a document, remind the student they can download it as PDF or Word using the "
    "download button on your message, then edit and submit it.\n\n"

    "INTERVIEW PREP (make this genuinely excellent):\n"
    "- Tailor likely questions to the specific scholarship and funder, not generic ones.\n"
    "- Give model answers using the STAR method (Situation, Task, Action, Result) built from the "
    "student's real background.\n"
    "- Offer to run a realistic mock interview: ask one question at a time, wait for their answer, "
    "then give honest, specific feedback and a stronger version.\n"
    "- Cover logistics too: what to bring, how to dress, timing, and three strong questions the "
    "student should ask the panel.\n\n"

    "FORMAT: For advice and comparisons, be skimmable with short paragraphs, bullets and bold key "
    "facts, and finish with a clear next step. For documents, use flowing prose. Remember: no em dashes.\n"
)


def _assistant_context(user):
    """Build a grounding block from the student's real profile, matches and
    applications so the model advises on actual data instead of guessing."""
    lines = []
    name = user.get_full_name() or user.first_name or 'the student'
    lines.append(f"Name: {name} <{user.email}>")

    profile = getattr(user, 'profile', None)
    if profile:
        bits = []
        if profile.student_type:
            bits.append(f"type={profile.student_type}")
        if profile.programme:
            bits.append(f"programme={profile.programme}")
        if profile.institution:
            bits.append(f"institution={profile.institution}")
        if profile.shs_school:
            bits.append(f"SHS={profile.shs_school}")
        level = profile.university_level or profile.shs_level or profile.level
        if level:
            bits.append(f"level={level}")
        if profile.region:
            bits.append(f"region={profile.region}")
        if profile.home_district:
            bits.append(f"district={profile.home_district}")
        if profile.wassce_aggregate is not None:
            bits.append(f"WASSCE aggregate={profile.wassce_aggregate} ({profile.wassce_status or 'status n/a'})")
        if profile.academic_standing:
            bits.append(f"standing={profile.academic_standing}")
        if profile.need_level:
            bits.append(f"financial need={profile.need_level}")
        lines.append("Profile: " + (", ".join(bits) if bits else "started but mostly empty"))
    else:
        lines.append("Profile: not completed — encourage finishing onboarding for accurate matching.")

    matches = list(
        MatchResult.objects.filter(student=user)
        .select_related('scholarship')
        .order_by('-score')[:15]
    )
    if matches:
        lines.append("\nMatches from our rule-based engine (use these; do not invent others):")
        for m in matches:
            s = m.scholarship
            deadline = s.deadline.strftime('%d %b %Y') if s.deadline else 'no stated deadline'
            unmet = [c.get('label') for c in (m.criteria or []) if not c.get('met')]
            gap = f"; not yet met: {', '.join(unmet)}" if unmet else ""
            flag = " [UNVERIFIED]" if s.origin == 'curated' else ""
            lines.append(
                f"- {s.name} ({s.provider}) — {s.amount}; {m.status} {m.score}%; "
                f"deadline {deadline}{flag}{gap}"
            )
    else:
        lines.append("\nMatches: none computed yet.")

    apps = list(Application.objects.filter(student=user).select_related('scholarship'))
    if apps:
        lines.append("\nApplications in progress:")
        for a in apps:
            lines.append(f"- {a.scholarship.name}: {a.status} ({a.progress}% complete)")
    else:
        lines.append("\nApplications: none started yet.")

    return "\n".join(lines)


def _no_em_dashes(text):
    """Safety net for the 'no em dashes' rule: a spaced em/en dash reads as a
    comma, a tight one as a hyphen. The system prompt bans them; this catches
    any that slip through so downloaded documents never contain one."""
    import re
    text = re.sub(r'\s+[—–]\s+', ', ', text)
    return text.replace('—', '-').replace('–', '-')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def assistant_chat(request):
    """POST /api/assistant/chat/ → a grounded LLM reply via Groq.

    Body: {"messages": [{"role": "user"|"assistant", "content": str}, ...]}
    The API key stays server-side (GROQ_API_KEY env); the client never sees it.
    """
    import requests as http

    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return Response(
            {'detail': "The assistant isn't switched on yet — the server needs a GROQ_API_KEY."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    raw = request.data.get('messages', [])
    if not isinstance(raw, list) or not raw:
        return Response({'detail': 'messages must be a non-empty list.'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Keep only well-formed, recent turns to bound token usage.
    history = []
    for m in raw[-20:]:
        if not isinstance(m, dict):
            continue
        role = m.get('role')
        content = (m.get('content') or '').strip()
        if role in ('user', 'assistant') and content:
            history.append({'role': role, 'content': content[:4000]})

    if not history or history[-1]['role'] != 'user':
        return Response({'detail': 'The last message must come from the user.'},
                        status=status.HTTP_400_BAD_REQUEST)

    system = ASSISTANT_SYSTEM + "\n\nSTUDENT DATA:\n" + _assistant_context(request.user)
    payload = {
        'model': os.environ.get('GROQ_MODEL', DEFAULT_GROQ_MODEL),
        'messages': [{'role': 'system', 'content': system}] + history,
        'temperature': 0.6,
        # Roomy enough for a full essay or motivation letter without truncation.
        'max_tokens': 4096,
    }

    try:
        resp = http.post(
            GROQ_URL,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=60,
        )
    except http.RequestException:
        return Response({'detail': 'The assistant is unreachable right now. Please try again.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    if resp.status_code != 200:
        # Log safely (Windows consoles are cp1252 — avoid unicode crashes) and
        # surface a friendly message rather than leaking provider internals.
        safe = resp.text[:500].encode('ascii', 'replace').decode('ascii')
        logging.getLogger('core').error('Groq error %s: %s', resp.status_code, safe)
        return Response({'detail': 'The assistant had trouble responding. Please try again in a moment.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    data = resp.json()
    reply = (data.get('choices', [{}])[0].get('message', {}).get('content') or '').strip()
    if not reply:
        reply = "I'm not sure how to answer that yet, could you give me a little more detail?"
    return Response({'reply': _no_em_dashes(reply)})


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
