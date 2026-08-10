"""Whether a text actually goes out, and the record that it did.

Feature code should call :func:`core.notifications.notify` rather than this
module directly; ``notify`` writes the in-app alert and fans out to every
channel the student accepts. :func:`send_sms` is the SMS half of that fan-out.

Every reason *not* to send is written down as a ``Skipped`` row rather than
dropped silently. "My reminder never arrived" is a question someone will ask,
and the answer should be one query away.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .backends import get_backend
from .phone import to_e164

logger = logging.getLogger('sms')


def _in_quiet_hours(now):
    """True inside the do-not-disturb window.

    Ghana keeps GMT all year and the project runs on ``TIME_ZONE = 'UTC'``, so
    the server clock is already Accra local time and there is no conversion to
    get wrong.

    Email has no equivalent guard on purpose: a text buzzes a phone at 3am, an
    unread message in an inbox does not.
    """
    start = settings.SMS_QUIET_HOURS_START
    end = settings.SMS_QUIET_HOURS_END
    if start == end:
        return False
    if start < end:
        return start <= now.hour < end
    # The window wraps midnight, e.g. 21:00 to 06:00.
    return now.hour >= start or now.hour < end


def _sent_in_last_day():
    from core.models import OutboundMessage
    since = timezone.now() - timedelta(days=1)
    # Queued counts: a row stuck mid-send may well have reached the gateway,
    # and the cap exists to bound spend, not to be precise about it.
    return OutboundMessage.objects.filter(
        channel='SMS', status__in=('Sent', 'Queued'), created_at__gte=since).count()


def _trim(text):
    """Keep a message inside one billed segment.

    A plain GSM-7 text is 160 characters; one non-GSM character (a curly quote,
    an en dash, an arrow) silently drops the whole message to 70 and doubles the
    bill. Message builders here stick to ASCII, and this is the backstop.
    """
    limit = settings.SMS_MAX_LENGTH
    text = ' '.join(str(text).split())
    if len(text) <= limit:
        return text
    logger.warning('Trimming SMS from %d to %d characters.', len(text), limit)
    return text[:limit - 3].rstrip() + '...'


def send_sms(student, text, *, notification=None, dedupe_key='', ignore_quiet_hours=False):
    """Send one text to one student, recording the attempt either way.

    Returns the :class:`~core.models.OutboundMessage` row. Never raises for an
    ordinary delivery failure — a batch must survive one bad number.
    """
    from core.models import OutboundMessage

    text = _trim(text)

    if dedupe_key:
        already = OutboundMessage.objects.filter(
            channel='SMS', dedupe_key=dedupe_key).first()
        if already is not None:
            logger.info('Already handled %r; not sending again.', dedupe_key)
            return already

    def record(status, **fields):
        # Skipped rows deliberately carry no dedupe_key. A skip comes from a
        # condition that can change — SMS switched off, quiet hours, an opt-out
        # the student may undo — and claiming the key would block the retry for
        # good. Only a real attempt claims it, just below.
        return OutboundMessage.objects.create(
            student=student, notification=notification, channel='SMS',
            body=text, status=status, **fields)

    if not settings.SMS_ENABLED:
        return record('Skipped', error='SMS_ENABLED is off')

    profile = getattr(student, 'profile', None)
    if profile is None:
        return record('Skipped', error='student has no profile')
    if not profile.sms_opt_in:
        return record('Skipped', error='student opted out of SMS')

    number = to_e164(profile.phone)
    if not number:
        # Nothing in the stack validates this column, so unusable numbers are
        # expected rather than exceptional. Skipping is free; sending is not.
        return record('Skipped', error=f'unusable phone number: {profile.phone!r}'[:300])

    if not ignore_quiet_hours and _in_quiet_hours(timezone.now()):
        return record('Skipped', recipient=number, error='inside quiet hours')

    if _sent_in_last_day() >= settings.SMS_DAILY_CAP:
        # The kill switch. A loop that starts texting in circles stops here
        # instead of at the bottom of the account.
        logger.error('SMS daily cap of %d reached; refusing to send.', settings.SMS_DAILY_CAP)
        return record('Skipped', recipient=number, error='daily send cap reached')

    backend = get_backend()
    provider = type(backend).__name__.replace('SmsBackend', '').lower()

    # Claim the event before calling out, so the partial unique index on
    # (channel, dedupe_key) — not our own timing — is what guarantees one send.
    try:
        with transaction.atomic():
            message = OutboundMessage.objects.create(
                student=student, notification=notification, channel='SMS',
                body=text, status='Queued', recipient=number, provider=provider,
                dedupe_key=dedupe_key)
    except IntegrityError:
        existing = OutboundMessage.objects.filter(
            channel='SMS', dedupe_key=dedupe_key).first()
        logger.info('Already sent %r; skipping duplicate.', dedupe_key)
        return existing

    result = backend.send(number, text)

    message.status = 'Sent' if result.ok else 'Failed'
    message.provider_message_id = result.provider_message_id
    message.error = result.error
    message.save(update_fields=['status', 'provider_message_id', 'error'])

    if not result.ok:
        logger.warning('SMS to %s failed: %s', number, result.error)
    return message
