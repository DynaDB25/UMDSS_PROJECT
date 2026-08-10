"""Whether an email actually goes out, and the record that it did.

Feature code should call :func:`core.notifications.notify` rather than this
module directly.

The guardrails are deliberately not the same as the SMS ones. There is no quiet
hours check — an unread message sitting in an inbox wakes nobody — and no
length trimming, because an email has no segment to overrun. What email does
share is a hard cap, since Brevo's free plan allows 300 sends a day and a loop
would burn the whole allowance before anyone noticed.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone

from .backends import get_backend

logger = logging.getLogger('mailer')


def _usable_address(raw):
    """Return a deliverable address, or ``None``.

    Registration uses the email as the username, so it is almost always sane —
    but seeded and admin-created accounts are not held to that, and sending to
    a malformed address burns one of the day's 300 for nothing.
    """
    address = (raw or '').strip()
    if not address:
        return None
    try:
        validate_email(address)
    except ValidationError:
        return None
    return address


def _sent_in_last_day():
    from core.models import OutboundMessage
    since = timezone.now() - timedelta(days=1)
    return OutboundMessage.objects.filter(
        channel='Email', status__in=('Sent', 'Queued'), created_at__gte=since).count()


def send_email(student, subject, body, *, notification=None, dedupe_key=''):
    """Send one email to one student, recording the attempt either way.

    Returns the :class:`~core.models.OutboundMessage` row. Never raises for an
    ordinary delivery failure — a batch must survive one bad address.
    """
    from core.models import OutboundMessage

    subject = ' '.join(str(subject).split())[:200]

    if dedupe_key:
        already = OutboundMessage.objects.filter(
            channel='Email', dedupe_key=dedupe_key).first()
        if already is not None:
            logger.info('Already handled %r; not sending again.', dedupe_key)
            return already

    def record(status, **fields):
        # As with SMS, a Skipped row carries no dedupe_key: the condition that
        # caused it can change, and claiming the key would block the retry.
        return OutboundMessage.objects.create(
            student=student, notification=notification, channel='Email',
            subject=subject, body=body, status=status, **fields)

    if not settings.EMAIL_ENABLED:
        return record('Skipped', error='EMAIL_ENABLED is off')

    profile = getattr(student, 'profile', None)
    if profile is None:
        return record('Skipped', error='student has no profile')
    if not profile.email_opt_in:
        return record('Skipped', error='student opted out of email')

    address = _usable_address(student.email)
    if not address:
        return record('Skipped', error=f'unusable email address: {student.email!r}'[:300])

    if _sent_in_last_day() >= settings.EMAIL_DAILY_CAP:
        logger.error('Email daily cap of %d reached; refusing to send.',
                     settings.EMAIL_DAILY_CAP)
        return record('Skipped', recipient=address, error='daily send cap reached')

    backend = get_backend()
    provider = type(backend).__name__.replace('EmailBackend', '').lower()

    # Claim the event before calling out, so the partial unique index on
    # (channel, dedupe_key) is what guarantees one send, not our own timing.
    try:
        with transaction.atomic():
            message = OutboundMessage.objects.create(
                student=student, notification=notification, channel='Email',
                subject=subject, body=body, status='Queued', recipient=address,
                provider=provider, dedupe_key=dedupe_key)
    except IntegrityError:
        existing = OutboundMessage.objects.filter(
            channel='Email', dedupe_key=dedupe_key).first()
        logger.info('Already sent %r; skipping duplicate.', dedupe_key)
        return existing

    result = backend.send(
        address, subject, body, to_name=student.get_full_name() or student.username)

    message.status = 'Sent' if result.ok else 'Failed'
    message.provider_message_id = result.provider_message_id
    message.error = result.error
    message.save(update_fields=['status', 'provider_message_id', 'error'])

    if not result.ok:
        logger.warning('Email to %s failed: %s', address, result.error)
    return message
