from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
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
    # Only live-scraped, source-linked rows are ever served. Demo fixtures and
    # unverified curated fallbacks are filtered out here regardless of what is
    # in the table, so the app can never show a scholarship a student cannot
    # trace back to the provider that published it.
    queryset = Scholarship.objects.verifiable()
    serializer_class = ScholarshipSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    # Don't re-crawl a page that gave us nothing until this has passed.
    RECHECK_AFTER_DAYS = 7

    @action(detail=True, methods=['post'], url_path='find-form')
    def find_form(self, request, slug=None):
        """POST /scholarships/{slug}/find-form/ → locate the application form.

        Called by the app when a scholarship has no known form yet, so students
        get one without anyone curating links by hand. Cached on the row: a hit
        is permanent, a miss backs off for a week.
        """
        import datetime as _dt
        from django.utils import timezone
        from .form_finder import discover_application_form

        s = self.get_object()

        if s.application_url or s.application_email:
            return Response({
                'applicationUrl': s.application_url,
                'applicationEmail': s.application_email,
                'applicationMode': s.application_mode,
                'candidates': s.application_candidates or [],
                'searched': False,
            })

        if s.application_checked_at and timezone.now() - s.application_checked_at < _dt.timedelta(
            days=self.RECHECK_AFTER_DAYS
        ):
            # The crawl already ran and found nothing certain, but the shortlist
            # it produced is still the best help we can give.
            return Response({
                'applicationUrl': '', 'applicationEmail': '',
                'applicationMode': s.application_mode,
                'candidates': s.application_candidates or [],
                'searched': False,
            })

        found = discover_application_form(
            s.source_url, name=s.name, provider=s.provider,
        )
        s.application_url = (found['url'] or '')[:500]
        s.application_email = (found['email'] or '')[:254]
        if found['url'] or found['email']:
            s.application_mode = found['mode']
        s.application_candidates = found.get('candidates') or []
        s.application_checked_at = timezone.now()
        s.save(update_fields=[
            'application_url', 'application_email', 'application_mode',
            'application_candidates', 'application_checked_at',
        ])

        return Response({
            'applicationUrl': s.application_url,
            'applicationEmail': s.application_email,
            'applicationMode': s.application_mode,
            'candidates': s.application_candidates,
            'searched': True,
        })

    @action(detail=True, methods=['post'], url_path='suggest-form',
            permission_classes=[permissions.IsAuthenticated])
    def suggest_form(self, request, slug=None):
        """POST /scholarships/{slug}/suggest-form/ → a student reports where the
        application actually lives.

        The crawler cannot reach every funder, but a student standing on the
        provider's site can. Two independent students reporting the same link
        promotes it for everyone, so no single submission can misdirect people
        and nobody has to curate it by hand.
        """
        from django.core.exceptions import ValidationError
        from django.core.validators import URLValidator

        from .form_finder import _is_safe_url
        from .models import SuggestedApplicationLink

        s = self.get_object()
        url = (request.data.get('url') or '').strip()

        if not url.lower().startswith(('http://', 'https://')):
            url = 'https://' + url

        # URLValidator rejects the malformed input that a bare SSRF check waves
        # through (an unresolvable host is "safe" but still is not a link).
        try:
            URLValidator(schemes=['http', 'https'])(url)
        except ValidationError:
            return Response({'detail': 'That does not look like a valid web link.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if len(url) > 500 or not _is_safe_url(url):
            return Response({'detail': 'That does not look like a valid public web link.'},
                            status=status.HTTP_400_BAD_REQUEST)

        SuggestedApplicationLink.objects.update_or_create(
            scholarship=s, student=request.user, defaults={'url': url},
        )

        # Compare ignoring the trailing slash so the same page reported two
        # slightly different ways still counts as agreement.
        def norm(u):
            return u.rstrip('/').lower()

        votes = sum(
            1 for link in SuggestedApplicationLink.objects.filter(scholarship=s)
            if norm(link.url) == norm(url)
        )

        promoted = False
        if votes >= SuggestedApplicationLink.CONFIRMATIONS_NEEDED and not s.application_url:
            s.application_url = url
            s.application_mode = 'online'
            s.save(update_fields=['application_url', 'application_mode'])
            promoted = True

        return Response({
            'accepted': True,
            'votes': votes,
            'needed': SuggestedApplicationLink.CONFIRMATIONS_NEEDED,
            'promoted': promoted,
            'applicationUrl': s.application_url,
        })


# ── Matches ───────────────────────────────────────────

class MatchListView(generics.ListAPIView):
    """GET /api/matches/  → matches for the logged-in user"""
    serializer_class = MatchResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Mirror the catalogue's provenance gate: never surface a match for a
        # scholarship the app would not otherwise show. This keeps the two views
        # consistent even in the window between deploying this code and purging
        # the old seeded/curated rows from the database.
        return MatchResult.objects.filter(
            student=self.request.user,
            scholarship__origin='scraped',
        ).exclude(scholarship__source_url='').select_related('scholarship')


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
            # Same authenticity gate the catalogue uses. Without it a slug
            # guessed or kept from an older build could start an application
            # against a demo fixture, which the browse surfaces never show.
            scholarship = Scholarship.objects.verifiable().get(slug=slug)
        except Scholarship.DoesNotExist:
            return Response({'detail': 'That scholarship no longer exists.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Applying twice is a no-op: return the existing application instead of
        # erroring, so the UI can just route the student to their tracker.
        existing = Application.objects.filter(
            student=request.user, scholarship=scholarship).first()
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        # Smart auto-attach: match each required document against the student's
        # vault by type, and snapshot what was attached vs still missing.
        from django.db.models import F
        from .documents import match_requirement, label_for

        required = scholarship.documents or []
        vault = list(VaultDocument.objects.filter(student=request.user))
        attached, attached_ids = [], []
        for req in required:
            key = match_requirement(req)
            doc = next((d for d in vault if key and d.doc_type == key), None)
            if doc:
                attached.append({
                    'requirement': req,
                    'name': doc.name,
                    'doc_type': doc.doc_type,
                    'label': label_for(doc.doc_type),
                    'have': True,
                })
                attached_ids.append(doc.id)
            else:
                attached.append({'requirement': req, 'have': False})

        req_count = len(required)
        have_count = sum(1 for a in attached if a['have'])
        # Preparing the file is real progress, but the application is not
        # submitted until the student sends it to the funder.
        progress = (10 + int(40 * have_count / req_count)) if req_count else 25

        today = datetime.date.today().strftime('%b %d, %Y')
        timeline = [{'label': 'Application started', 'date': today, 'done': True}]
        if req_count:
            timeline.append({
                'label': f'Documents ready ({have_count}/{req_count})',
                'date': today if have_count == req_count else 'In progress',
                'done': have_count == req_count,
            })
        timeline += [
            {'label': f'Submit to {scholarship.provider}', 'date': 'Not yet', 'done': False},
            {'label': 'Under review', 'date': 'Pending', 'done': False},
            {'label': 'Decision', 'date': 'Pending', 'done': False},
        ]

        app = Application.objects.create(
            student=request.user,
            scholarship=scholarship,
            # ScholarCircle does not submit on the student's behalf, so calling
            # this 'Submitted' would be a lie. It stays a draft until they
            # confirm they sent it to the provider.
            status='Draft',
            submitted_on='-',
            progress=progress,
            timeline=timeline,
            attached_documents=attached,
        )

        # Count these documents as linked to one more application.
        if attached_ids:
            VaultDocument.objects.filter(id__in=attached_ids).update(
                linked_applications=F('linked_applications') + 1)

        if req_count:
            doc_line = (f'{have_count} of {req_count} required documents were matched '
                        f'from your vault.')
            if have_count < req_count:
                doc_line += ' Upload the missing ones to complete your pack.'
        else:
            doc_line = 'This funder did not list specific document requirements.'
        from .notifications import notify
        # No text: the student is looking at the screen that created this, so a
        # credit spent to tell them what they just did is a credit wasted. Email
        # earns its place because the document checklist below is something they
        # will want to come back to when they are next near their files.
        notify(
            request.user,
            category='Status',
            title=f'Application started: {scholarship.name}',
            body=(f'Your application pack for {scholarship.provider} is ready. {doc_line} '
                  f'Next step: send it to the provider, then mark it submitted here to track it.'),
            email=True,
            dedupe_key=f'app-started:{app.id}',
        )
        return Response(self.get_serializer(app).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='documents-zip')
    def documents_zip(self, request, pk=None):
        """GET /applications/{id}/documents-zip/ → every required document for
        this application in one archive, ready to upload to the provider.

        Documents are matched live rather than from the stored snapshot, so a
        file uploaded after the application was started is still included.
        """
        import io
        import os as _os
        import zipfile
        from django.http import HttpResponse as _HttpResponse
        from .documents import match_requirement, label_for

        app = self.get_object()
        required = app.scholarship.documents or []
        vault = list(VaultDocument.objects.filter(student=request.user))

        buf = io.BytesIO()
        included, missing = [], []
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            position = 0
            for req in required:
                key = match_requirement(req)
                doc = next((d for d in vault if key and d.doc_type == key), None)
                data = VaultDocumentViewSet.decrypt(doc) if doc else None
                if doc is None or data is None:
                    missing.append(req)
                    continue
                position += 1
                ext = _os.path.splitext(VaultDocumentViewSet.original_name(doc))[1] or ''
                safe = ''.join(c for c in label_for(doc.doc_type) if c.isalnum() or c in ' -_').strip()
                zf.writestr(f'{position:02d} {safe}{ext}', data)
                included.append(f'{req}: {doc.name}')

            # A short checklist so the student can see at a glance what is in
            # the archive and what they still have to find.
            lines = [
                f'{app.scholarship.name}',
                f'Provider: {app.scholarship.provider}',
                '',
                'INCLUDED IN THIS ARCHIVE',
            ]
            lines += [f'  - {x}' for x in included] or ['  (nothing yet)']
            if missing:
                lines += ['', 'STILL MISSING, UPLOAD THESE TO YOUR VAULT']
                lines += [f'  - {x}' for x in missing]
            if app.scholarship.application_url:
                lines += ['', f'Apply at: {app.scholarship.application_url}']
            lines += ['', 'Prepared by ScholarCircle. Confirm requirements with the provider.']
            zf.writestr('checklist.txt', '\n'.join(lines))

        if not included:
            return Response(
                {'detail': 'None of the required documents are in your vault yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        slug = ''.join(c for c in app.scholarship.name if c.isalnum() or c in ' -_').strip()
        slug = slug.replace(' ', '_')[:50] or 'application'
        resp = _HttpResponse(buf.getvalue(), content_type='application/zip')
        resp['Content-Disposition'] = f'attachment; filename="{slug}_documents.zip"'
        return resp

    @action(detail=True, methods=['post'], url_path='mark-submitted')
    def mark_submitted(self, request, pk=None):
        """POST /applications/{id}/mark-submitted/ → the student confirms they
        actually sent the application to the provider."""
        import datetime
        app = self.get_object()
        if app.status != 'Draft':
            return Response(self.get_serializer(app).data)

        today = datetime.date.today().strftime('%b %d, %Y')
        app.status = 'Submitted'
        app.submitted_on = today
        app.progress = max(app.progress, 60)
        timeline = app.timeline or []
        for step in timeline:
            if str(step.get('label', '')).startswith('Submit to'):
                step['done'] = True
                step['date'] = today
        app.timeline = timeline
        app.save(update_fields=['status', 'submitted_on', 'progress', 'timeline'])

        from .notifications import notify
        # This one gets both: it is the receipt for the only step that happens
        # off-platform, and it is worth having in a student's messages and inbox
        # when a provider later asks whether they applied. dedupe_key means a
        # double tap on Submit cannot send it twice on either channel.
        short_name = app.scholarship.name[:60].rstrip()
        notify(
            request.user,
            category='Status',
            title=f'Application submitted: {app.scholarship.name}',
            body=(f'You marked your {app.scholarship.name} application as submitted to '
                  f'{app.scholarship.provider}. We will keep it in your tracker.'),
            sms_text=(f'ScholarCircle: Your {short_name} application is marked submitted. '
                      f'Track it in the app.'),
            email=True,
            dedupe_key=f'app-submitted:{app.id}',
            # The student is mid-action, so the do-not-disturb window is about
            # somebody else's sleep, not theirs.
            ignore_quiet_hours=True,
        )
        return Response(self.get_serializer(app).data)


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
        from .documents import is_valid_type, category_for

        # What kind of document is this? Drives the vault checklist and the
        # auto-attach at apply time. Fall back to 'other' if unrecognised.
        doc_type = (self.request.data.get('doc_type') or '').strip()
        if not is_valid_type(doc_type):
            doc_type = 'other'
        category = category_for(doc_type)

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
            doc_type=doc_type,
            category=category,
            size=size_str,
            file_type=file_type,
            uploaded_on=datetime.date.today().strftime('%b %d, %Y'),
            status='Verified',  # Auto-verify for demonstration
            encrypted=True
        )

    @staticmethod
    def decrypt(document):
        """Plaintext bytes for a stored vault document, or None if unreadable.
        Shared by the single-file download and the application ZIP bundle."""
        if not document.file:
            return None
        try:
            with document.file.open('rb') as f:
                secure_data = f.read()
            key = base64.urlsafe_b64decode(settings.VAULT_ENCRYPTION_KEY)
            return AESGCM(key).decrypt(secure_data[:12], secure_data[12:], None)
        except Exception:
            return None

    @staticmethod
    def original_name(document):
        """The filename as the student uploaded it, without the .enc suffix."""
        return (document.file.name or '').split('/')[-1].replace('.enc', '')

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


# ── Phone verification ────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def phone_otp_request(request):
    """POST /api/auth/phone/otp/ → email (or text) a one-time code.

    Body: {"phone": "0244123456", "channel": "sms"}. Both are optional: the
    number falls back to the one already on the profile, and without a channel
    the code goes by whichever one core.otp leads with. The code itself is
    never returned, only the masked destination it was sent to.
    """
    from .otp import OtpError, request_code

    profile = getattr(request.user, 'profile', None)
    phone = (request.data.get('phone') or getattr(profile, 'phone', '') or '').strip()

    try:
        info = request_code(request.user, phone, channel=request.data.get('channel'))
    except OtpError as exc:
        body = {'detail': exc.detail}
        if exc.retry_after:
            body['retryAfter'] = exc.retry_after
        return Response(
            body,
            status=status.HTTP_429_TOO_MANY_REQUESTS if exc.retry_after
            else status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        'channel': info['channel'],
        'sentTo': info['sent_to'],
        'phone': info['phone'],
        'altChannel': info['alt_channel'],
        'expiresIn': info['expires_in'],
        'resendIn': info['resend_in'],
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def phone_otp_verify(request):
    """POST /api/auth/phone/verify/ → confirm the code and mark the number verified.

    Body: {"code": "123456"}
    """
    from .otp import OtpError, verify_code

    try:
        record = verify_code(request.user, request.data.get('code'))
    except OtpError as exc:
        return Response({'detail': exc.detail}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'verified': True, 'phone': record.phone})


# ── AI Assistant ──────────────────────────────────────

import logging
import re as _re
from django.http import StreamingHttpResponse

# The assistant uses Gemini as the primary provider (it does the real work) and
# falls back to Groq automatically if Gemini is unavailable, so a Gemini outage,
# bad key or rate limit never takes the assistant down. _order() returns the
# providers to try, in priority order, including only those whose key is set.
# AI_PROVIDER can pin a single provider (no fallback) when set to a valid name.
def _order():
    keys = {
        'gemini': bool(os.environ.get('GEMINI_API_KEY')),
        'groq': bool(os.environ.get('GROQ_API_KEY')),
    }
    explicit = os.environ.get('AI_PROVIDER', '').strip().lower()
    if explicit in ('gemini', 'groq'):
        return [explicit] if keys[explicit] else []
    return [p for p in ('gemini', 'groq') if keys[p]]


# Groq (OpenAI-compatible chat completions). Overridable so we can point at a
# local stand-in or swap models without a code change.
GROQ_URL = os.environ.get(
    'GROQ_BASE_URL', 'https://api.groq.com/openai/v1/chat/completions'
)
DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

# Gemini (Google Generative Language REST API). Use the rolling `-latest` alias
# rather than a pinned version: Google retires specific versions for new API
# users (gemini-2.5-flash now returns 404 for keys created after its cutoff),
# and the alias always resolves to a current, free-tier flash model. Override
# with GEMINI_MODEL if a specific one is ever needed.
GEMINI_BASE = os.environ.get(
    'GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'
)
DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

ASSISTANT_SYSTEM = (
    "You are the ScholarCircle Decision Bot. Think of yourself as a sharp, warm Ghanaian mentor who "
    "has sat on scholarship panels and now helps students win them. You compare awards, check "
    "eligibility, plan deadlines, write and sharpen essays and personal statements, and run mock "
    "interviews.\n\n"

    "HOW YOU TALK. This matters more than anything else here. The student must never be able to "
    "tell they are reading a machine. Write the way a thoughtful Ghanaian mentor actually writes.\n"
    "- Plain prose in short paragraphs. That is the default and it covers almost every reply.\n"
    "- NO MARKDOWN FURNITURE in normal conversation. No headings, no bold, no numbered sections, no "
    "bullet points. A chat reply is sentences, not a document with scaffolding. The single exception "
    "is a genuine list of three or more parallel things (four scholarships, five documents to "
    "gather); even then, keep each line short and plain.\n"
    "- Start with the answer. No 'Great question', no 'Certainly', no 'Absolutely', no repeating "
    "their question back at them, no announcing what you are about to do.\n"
    "- Kill the tells. No rhetorical question openers ('Ever wondered...'), no 'Here's the thing', "
    "no 'The truth is', no 'Let me break this down', no three-item rhythms for the sake of rhythm, "
    "no 'not just X, but Y' constructions, no closing summary that repeats what you just said.\n"
    "- Never use em dashes or en dashes. Use commas, full stops, colons, brackets or the word 'and'. "
    "This is a hard rule.\n"
    "- Banned filler: 'in today's fast-paced world', 'it is important to note', 'delve', 'tapestry', "
    "'navigate the landscape', 'unlock your potential', 'leverage', 'moreover', 'furthermore', "
    "'embark on a journey', 'let's dive in', 'that said', 'at the end of the day', 'crucial', "
    "'robust', 'seamless', 'game changer'. Just say the thing.\n"
    "- Vary your sentence length. Some short. Some longer, carrying a thought through a clause or "
    "two before it lands. That variation is most of what makes writing sound human.\n"
    "- Contractions always: you're, don't, it's, they'll. Formal uncontracted English reads robotic.\n"
    "- Be concrete. Name the actual scholarship, the actual date, the actual cedi amount from their "
    "data. Vague encouragement is worthless to a student with a deadline.\n"
    "- Match their energy and length. A one line question gets a couple of sentences, not an essay. "
    "Go long only when they ask for something long.\n"
    "- Do not end every message with a cheerful offer to help further. Close with a real next step, "
    "a real question, or just stop talking.\n"
    "- If one sharp question would make your answer twice as useful, ask it instead of guessing. One "
    "question, not a list of five.\n"
    "- Use their first name occasionally, the way a mentor would. Not in every message.\n"
    "- It is fine to be direct about bad news. If their aggregate rules them out of an award, say so "
    "kindly and move them to what they can actually win.\n\n"

    "ACCURACY:\n"
    "- Ground every answer in the STUDENT DATA below. Never invent scholarships, amounts, deadlines "
    "or eligibility rules that are not in that data. If something isn't there, say so plainly and "
    "point the student to the Scholarships page.\n"
    "- Money is in Ghana Cedis (GH₵); use Ghanaian/UK date style (day month year).\n"
    "- Listings flagged UNVERIFIED may be out of date, so tell the student to confirm those details "
    "on the provider's official website before relying on them.\n"
    "- You are not a lawyer or a licensed financial adviser; for legal or financial specifics, tell "
    "the student to confirm with the provider or a qualified professional.\n\n"

    "WRITING DOCUMENTS (essays, personal statements, motivation letters, cover letters, CVs):\n"
    "- This is the part that must not read as machine written. A scholarship panel reads hundreds of "
    "these and can smell a generated essay in one paragraph. Write like the student, not like a "
    "template.\n"
    "- Open with something only this student could write: a specific moment, place, class, person or "
    "problem from their real profile, programme, region or school. Never open with a definition, a "
    "quotation, a statistic or 'From a young age I have always been passionate about'.\n"
    "- Ground every claim in their actual data. A named school, a real aggregate, their district, "
    "their programme. Specificity is what makes it believable.\n"
    "- Flowing prose in real paragraphs. No bullet points, no headings, no bold inside the piece. "
    "Give it a clear title line and then let it run as writing.\n"
    "- Keep the register a bright student's own: clear, warm, confident, occasionally imperfect in "
    "rhythm. Do not inflate the vocabulary. If a plain word works, use the plain word.\n"
    "- Avoid the essay cliches: 'passion', 'journey', 'blessed', 'impact the lives of', 'give back "
    "to my community', 'burning desire', 'ever since I was a child'. Show the thing instead.\n"
    "- If you are missing something that would make the piece strong, either ask two or three sharp "
    "questions first, or write the full draft and mark assumptions in [square brackets].\n"
    "- After delivering a document, tell them once that they can download it as PDF or Word from the "
    "button on your message.\n"
)

# Appended when the student starts a live mock interview. The protocol is
# strict because the whole value is in it behaving like a real panel: one
# question, silence, then honest feedback.
INTERVIEW_PROTOCOL = (
    "\n\nYOU ARE NOW RUNNING A LIVE MOCK INTERVIEW. Follow this exactly.\n\n"
    "Rules of the room:\n"
    "- Ask exactly ONE question per message, then stop. Never ask two. Never answer it yourself.\n"
    "- Stay in character as a panel member for the question itself. Be courteous but probing.\n"
    "- The interview runs for six questions, then a debrief.\n\n"
    "Question arc, tailored to the specific scholarship and the student's real profile:\n"
    "1. An opener about who they are and why this award.\n"
    "2. Their academic record, including any weak spot visible in their data.\n"
    "3. A behavioural question about leadership, service or overcoming a setback.\n"
    "4. A question about their field and where they want to take it.\n"
    "5. A hard one. Press on a genuine gap, a competing candidate, or what they would do if they "
    "did not get the funding.\n"
    "6. 'What would you like to ask us?'\n\n"
    "After every answer they give, before the next question, respond in exactly this shape:\n"
    "**Score: N/10**\n"
    "One short paragraph on what genuinely worked. Be specific, quote their words back.\n"
    "One short paragraph on the single biggest fix. Not five fixes, the one that matters most.\n"
    "**Sharper version**\n"
    "Rewrite their answer the way a strong candidate would say it, in their voice, using their real "
    "details from the STUDENT DATA. Keep it speakable, around 45 to 90 seconds.\n"
    "Then ask the next question, on its own line, prefixed with **Question N of 6**.\n\n"
    "If they give a thin or one line answer, do not accept it. Score it honestly, say what is "
    "missing, and ask them to try that same question again before moving on.\n\n"
    "After question six, close with **Debrief**: their overall score out of 10, the two things to "
    "practise before the real panel, and three strong questions they should ask on the day. Then "
    "stop and offer to run it again.\n\n"
    "Open the session with a one line greeting, then **Question 1 of 6**. No preamble beyond that.\n"
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
        lines.append("Profile: not completed, encourage finishing onboarding for accurate matching.")

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
                f"- {s.name} ({s.provider}), {s.amount}; {m.status} {m.score}%; "
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


# Written as escapes on purpose. Spelling these out as literal characters once
# cost us the whole function: a find-and-replace over em dashes rewrote them
# inside this very pattern, leaving [--], which then ate every spaced hyphen in
# the model's output, markdown bullets included.
_EM_DASH_SPACED = _re.compile('\\s+[\u2014\u2013]\\s+')


def _no_em_dashes(text):
    """Safety net for the 'no em dashes' rule: a spaced em/en dash reads as a
    comma, a tight one as a hyphen. The system prompt bans them; this catches
    any that slip through so downloaded documents never contain one.

    Ordinary hyphens are left alone.
    """
    text = _EM_DASH_SPACED.sub(', ', text)
    return text.replace('\u2014', '-').replace('\u2013', '-')


def _assistant_conversation(request):
    """Validate the request and build the provider-neutral (system, history).

    Returns (system, history, None) on success or (None, None, Response) on
    failure, so the buffered and streaming endpoints share one set of rules.
    History is a list of {'role': 'user'|'assistant', 'content': str}.
    """
    raw = request.data.get('messages', [])
    if not isinstance(raw, list) or not raw:
        return None, None, Response({'detail': 'messages must be a non-empty list.'},
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
        return None, None, Response({'detail': 'The last message must come from the user.'},
                                    status=status.HTTP_400_BAD_REQUEST)

    system = ASSISTANT_SYSTEM + "\n\nSTUDENT DATA:\n" + _assistant_context(request.user)

    # A live mock interview needs a much stricter protocol than open chat.
    if request.data.get('mode') == 'interview':
        system += INTERVIEW_PROTOCOL
        target = (request.data.get('scholarship') or '').strip()
        if target:
            system += f"\nThe student is being interviewed for: {target[:200]}.\n"

    return system, history, None


def _sse(obj):
    import json as _json
    return f"data: {_json.dumps(obj)}\n\n"


def _sse_response(generator):
    response = StreamingHttpResponse(generator, content_type='text/event-stream')
    # Keep proxies and the dev server from buffering the stream into one blob.
    response['Cache-Control'] = 'no-cache, no-transform'
    response['X-Accel-Buffering'] = 'no'
    return response


class _ProviderError(Exception):
    """A provider call failed in a way that should trigger fallback."""


# ── Groq provider (OpenAI-compatible) ──

def _groq_payload(system, history, stream=False):
    payload = {
        'model': os.environ.get('GROQ_MODEL', DEFAULT_GROQ_MODEL),
        'messages': [{'role': 'system', 'content': system}] + history,
        # Slightly warmer than default so the voice doesn't flatten into a report.
        'temperature': 0.75,
        'presence_penalty': 0.3,
        # Roomy enough for a full essay or motivation letter without truncation.
        'max_tokens': 4096,
    }
    if stream:
        payload['stream'] = True
    return payload


def _groq_reply(system, history):
    import requests as http
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        raise _ProviderError('missing GROQ_API_KEY')
    try:
        resp = http.post(
            GROQ_URL,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=_groq_payload(system, history), timeout=60,
        )
    except http.RequestException as exc:
        raise _ProviderError(f'unreachable: {exc}')
    if resp.status_code != 200:
        safe = resp.text[:300].encode('ascii', 'replace').decode('ascii')
        raise _ProviderError(f'HTTP {resp.status_code}: {safe}')
    data = resp.json()
    return data.get('choices', [{}])[0].get('message', {}).get('content') or ''


def _groq_deltas(system, history):
    import json as _json
    import requests as http
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        raise _ProviderError('missing GROQ_API_KEY')
    try:
        resp = http.post(
            GROQ_URL,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=_groq_payload(system, history, stream=True), timeout=120, stream=True,
        )
    except http.RequestException as exc:
        raise _ProviderError(f'unreachable: {exc}')
    with resp:
        if resp.status_code != 200:
            safe = resp.text[:300].encode('ascii', 'replace').decode('ascii')
            raise _ProviderError(f'HTTP {resp.status_code}: {safe}')
        try:
            for line in resp.iter_lines(decode_unicode=True):
                if not line or not line.startswith('data:'):
                    continue
                body = line[5:].strip()
                if body == '[DONE]':
                    break
                try:
                    chunk = _json.loads(body)
                except ValueError:
                    continue
                delta = ((chunk.get('choices') or [{}])[0].get('delta') or {}).get('content')
                if delta:
                    yield delta
        except http.RequestException as exc:
            raise _ProviderError(f'stream dropped: {exc}')


# ── Gemini provider (Google Generative Language REST) ──

def _gemini_request(system, history):
    """Translate the neutral (system, history) into Gemini's request body.

    Gemini uses the 'model' role for the assistant and carries the system prompt
    in a dedicated system_instruction field.

    No thinkingConfig: the flash-latest alias rejects it (HTTP 400), and it
    reasons internally by default. That internal reasoning counts against
    maxOutputTokens, so the budget is set high enough that a full essay still
    lands after the model has finished thinking, rather than truncating.
    """
    contents = [
        {'role': 'model' if m['role'] == 'assistant' else 'user',
         'parts': [{'text': m['content']}]}
        for m in history
    ]
    return {
        'system_instruction': {'parts': [{'text': system}]},
        'contents': contents,
        'generationConfig': {
            'temperature': 0.75,
            'maxOutputTokens': 8192,
        },
    }


def _gemini_url(kind):
    """kind is 'generateContent' or 'streamGenerateContent'."""
    model = os.environ.get('GEMINI_MODEL', DEFAULT_GEMINI_MODEL)
    return f"{GEMINI_BASE}/models/{model}:{kind}"


def _gemini_text(payload):
    """Pull the text out of a Gemini response (full body or one stream chunk)."""
    try:
        parts = payload['candidates'][0]['content']['parts']
        return ''.join(p.get('text', '') for p in parts)
    except (KeyError, IndexError, TypeError):
        return ''


def _gemini_reply(system, history):
    import requests as http
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise _ProviderError('missing GEMINI_API_KEY')
    try:
        resp = http.post(
            _gemini_url('generateContent'),
            headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key},
            json=_gemini_request(system, history), timeout=60,
        )
    except http.RequestException as exc:
        raise _ProviderError(f'unreachable: {exc}')
    if resp.status_code != 200:
        safe = resp.text[:300].encode('ascii', 'replace').decode('ascii')
        raise _ProviderError(f'HTTP {resp.status_code}: {safe}')
    return _gemini_text(resp.json())


def _gemini_deltas(system, history):
    import json as _json
    import requests as http
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise _ProviderError('missing GEMINI_API_KEY')
    try:
        resp = http.post(
            _gemini_url('streamGenerateContent') + '?alt=sse',
            headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key},
            json=_gemini_request(system, history), timeout=120, stream=True,
        )
    except http.RequestException as exc:
        raise _ProviderError(f'unreachable: {exc}')
    with resp:
        if resp.status_code != 200:
            safe = resp.text[:300].encode('ascii', 'replace').decode('ascii')
            raise _ProviderError(f'HTTP {resp.status_code}: {safe}')
        try:
            for line in resp.iter_lines(decode_unicode=True):
                if not line or not line.startswith('data:'):
                    continue
                body = line[5:].strip()
                if not body:
                    continue
                try:
                    chunk = _json.loads(body)
                except ValueError:
                    continue
                text = _gemini_text(chunk)
                if text:
                    yield text
        except http.RequestException as exc:
            raise _ProviderError(f'stream dropped: {exc}')


# ── Orchestration: primary provider first, then fallback ──

_REPLY_FNS = {'gemini': _gemini_reply, 'groq': _groq_reply}
_DELTA_FNS = {'gemini': _gemini_deltas, 'groq': _groq_deltas}


def _reply_with_fallback(system, history):
    """Try each configured provider in priority order; return the first reply."""
    errors = []
    for prov in _order():
        try:
            return _REPLY_FNS[prov](system, history)
        except _ProviderError as exc:
            errors.append(f'{prov}: {exc}')
            logging.getLogger('core').warning('assistant %s failed, falling back: %s', prov, exc)
    raise _ProviderError('; '.join(errors) or 'no provider configured')


def _deltas_with_fallback(system, history):
    """Yield raw text deltas, falling back to the next provider only when the
    current one fails before producing any text (a mid-stream drop cannot be
    recovered without duplicating what the student already sees)."""
    order = _order()
    if not order:
        raise _ProviderError('no provider configured')
    for i, prov in enumerate(order):
        produced = False
        try:
            for delta in _DELTA_FNS[prov](system, history):
                produced = True
                yield delta
            return
        except _ProviderError as exc:
            logging.getLogger('core').warning('assistant %s stream failed: %s', prov, exc)
            if produced or i == len(order) - 1:
                raise


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def assistant_chat(request):
    """POST /api/assistant/chat/ → a grounded LLM reply.

    Body: {"messages": [{"role": "user"|"assistant", "content": str}, ...]}
    Gemini is the primary provider with Groq as an automatic fallback (see
    _order). Keys stay server-side; the client never sees them. Kept as the
    non-streaming fallback for clients that cannot read a stream.
    """
    system, history, error = _assistant_conversation(request)
    if error:
        return error
    try:
        reply = _reply_with_fallback(system, history).strip()
    except _ProviderError:
        return Response({'detail': 'The assistant had trouble responding. Please try again in a moment.'},
                        status=status.HTTP_502_BAD_GATEWAY)
    if not reply:
        reply = "I'm not sure how to answer that yet, could you give me a little more detail?"
    return Response({'reply': _no_em_dashes(reply)})


# The dash cleaner rewrites ", " to ", ", so a chunk boundary could land mid
# pattern and let a dash escape. Holding back a few characters guarantees the
# pattern is fully formed before anything is emitted.
_STREAM_HOLDBACK = 4


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def assistant_stream(request):
    """POST /api/assistant/stream/ → the same grounded reply, streamed as SSE:
        data: {"delta": "..."}   incremental text
        data: {"done": true}     finished
        data: {"error": "..."}   something went wrong mid-stream

    Gemini is tried first and falls back to Groq if Gemini fails before any
    text has reached the student.
    """
    system, history, error = _assistant_conversation(request)
    if error:
        return error

    def event_stream():
        raw_text = ''
        sent = 0
        try:
            for delta in _deltas_with_fallback(system, history):
                raw_text += delta
                cleaned = _no_em_dashes(raw_text)
                safe_len = max(0, len(cleaned) - _STREAM_HOLDBACK)
                if safe_len > sent:
                    yield _sse({'delta': cleaned[sent:safe_len]})
                    sent = safe_len

            # Flush whatever the holdback was still sitting on.
            cleaned = _no_em_dashes(raw_text)
            if len(cleaned) > sent:
                yield _sse({'delta': cleaned[sent:]})

            if not raw_text.strip():
                yield _sse({'delta': "I'm not sure how to answer that yet, could you give me a little more detail?"})

            yield _sse({'done': True})
        except _ProviderError:
            # If some text already reached the student, close cleanly rather than
            # tacking an error onto a half-written answer.
            if raw_text.strip():
                yield _sse({'done': True})
            else:
                yield _sse({'error': 'The assistant had trouble responding. Please try again in a moment.'})
        except Exception:  # noqa: BLE001 - a dead stream must not 500 the page
            logging.getLogger('core').exception('Assistant stream failed')
            yield _sse({'error': 'The assistant stopped unexpectedly. Please try again.'})

    return _sse_response(event_stream())


# ── Admin ─────────────────────────────────────────────

class AdminStatsView(APIView):
    """GET /api/admin/stats/ → aggregate stats for the admin dashboard"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from django.db.models import Sum, Count

        # Total is the raw table so an admin can see rows the app hides;
        # "verified" is the same gate students are served through, which
        # excludes demo fixtures as well as curated fallbacks. Counting
        # origin='seeded' as verified overstated the real catalogue.
        total_scholarships = Scholarship.objects.count()
        verified_scholarships = Scholarship.objects.verifiable().count()
        active_applicants = User.objects.filter(applications__isnull=False).distinct().count()
        registered_users = User.objects.count()
        total_applications = Application.objects.count()

        # Sum of scholarship amounts for awarded applications
        total_awarded = Application.objects.filter(
            status='Awarded'
        ).aggregate(total=Sum('scholarship__amount_value'))['total'] or 0

        # Real breakdowns for the charts (no more mock trend data).
        status_map = {
            r['status']: r['c']
            for r in Application.objects.values('status').annotate(c=Count('id'))
        }
        by_status = [
            {'status': label, 'count': status_map.get(label, 0)}
            for label, _ in Application.STATUS_CHOICES
        ]
        by_region = [
            {'region': r['region'], 'count': r['c']}
            for r in (
                StudentProfile.objects.exclude(region='')
                .values('region')
                .annotate(c=Count('id'))
                .order_by('-c')[:6]
            )
        ]

        data = {
            'totalScholarships': total_scholarships,
            'verifiedScholarships': verified_scholarships,
            'activeApplicants': active_applicants,
            'registeredUsers': registered_users,
            'applicationsThisCycle': total_applications,
            'awardsDisbursed': f'GH₵ {total_awarded / 1_000_000:.1f}M' if total_awarded >= 1_000_000 else f'GH₵ {total_awarded:,}',
            'byStatus': by_status,
            'byRegion': by_region,
        }
        return Response(data)


class AdminApplicationsView(generics.ListAPIView):
    """GET /api/admin/applications/ → all applications for admin table"""
    permission_classes = [permissions.IsAdminUser]
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


class AdminScholarshipCreateView(APIView):
    """POST /api/admin/scholarships/ → staff add a scholarship by hand."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        from django.utils.text import slugify
        from django.utils.dateparse import parse_date

        d = request.data
        name = (d.get('name') or '').strip()
        provider = (d.get('provider') or '').strip()
        if not name or not provider:
            return Response({'detail': 'Name and provider are both required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Unique slug from the name.
        base = slugify(name)[:45] or 'scholarship'
        slug, i = base, 2
        while Scholarship.objects.filter(slug=slug).exists():
            slug = f'{base}-{i}'
            i += 1

        def as_list(v, default):
            if isinstance(v, list):
                return v or default
            if isinstance(v, str) and v.strip():
                return [x.strip() for x in v.split(',') if x.strip()] or default
            return default

        def as_int(v, default):
            try:
                return int(v)
            except (TypeError, ValueError):
                return default

        valid_types = {c[0] for c in Scholarship.PROVIDER_TYPES}
        valid_scopes = {c[0] for c in Scholarship.LEVEL_SCOPES}
        valid_genders = {c[0] for c in Scholarship.GENDER_SCOPES}
        provider_type = d.get('provider_type') if d.get('provider_type') in valid_types else 'Foundation'
        level_scope = d.get('level_scope') if d.get('level_scope') in valid_scopes else 'tertiary_any'
        gender_scope = d.get('gender_scope') if d.get('gender_scope') in valid_genders else 'any'

        scholarship = Scholarship.objects.create(
            slug=slug,
            name=name,
            provider=provider,
            provider_type=provider_type,
            initials=(''.join(w[0] for w in name.split()[:2]) or name[:2]).upper(),
            amount=(d.get('amount') or 'Amount varies').strip(),
            amount_value=as_int(d.get('amount_value'), 0),
            deadline=parse_date(d.get('deadline')) if d.get('deadline') else None,
            region=as_list(d.get('region'), ['All']),
            programmes=as_list(d.get('programmes'), ['All']),
            max_aggregate=as_int(d.get('max_aggregate'), 36),
            slots=as_int(d.get('slots'), 0),
            summary=(d.get('summary') or '').strip(),
            benefits=as_list(d.get('benefits'), []),
            documents=as_list(d.get('documents'), []),
            tags=as_list(d.get('tags'), []),
            origin='seeded',
            level_scope=level_scope,
            gender_scope=gender_scope,
            # No application link is entered by hand. The app discovers the real
            # form from this page the first time a student opens the listing.
            source_url=(d.get('source_url') or '').strip()[:500],
        )
        return Response(ScholarshipSerializer(scholarship).data, status=status.HTTP_201_CREATED)


# ── Reference data ────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def reference_data(request):
    """GET /api/reference/ → regions, programmes, document types etc."""
    from .documents import DOCUMENT_TYPES
    return Response({
        'documentTypes': [
            {'key': d['key'], 'label': d['label'], 'category': d['category'], 'keywords': d['keywords']}
            for d in DOCUMENT_TYPES
        ],
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
