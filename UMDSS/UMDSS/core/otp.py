"""One-time codes that prove a student controls a phone number.

Why this exists: deadline reminders are the product's promise, and a mistyped
digit means a student silently never hears from us again. Verifying the number
once turns that invisible failure into something the student can see and fix.

Three rules keep a six digit code safe enough to type on a phone:

* only the hash is stored, so a database leak yields nothing usable;
* guesses are counted on the code itself, not on the request, so an attacker
  cannot reset the counter by asking for a fresh attempt;
* sends are rate limited per student, which bounds both the spend and the
  nuisance value of pointing the endpoint at someone else's handset.

Delivery falls back to email when the SMS gateway will not take the message.
An alphanumeric sender ID has to be approved by the networks before Arkesel
will carry it, and until that lands SMS simply fails; a student should still be
able to finish verifying rather than being stuck behind a regulatory queue.
"""

import logging
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from .models import PhoneVerification
from .sms.backends import get_backend as get_sms_backend
from .sms.phone import to_e164

logger = logging.getLogger(__name__)

CODE_DIGITS = 6
CODE_TTL = timedelta(minutes=10)
# Per code. Five guesses against a six digit space is a 1 in 200,000 chance.
MAX_ATTEMPTS = 5
RESEND_COOLDOWN = timedelta(seconds=60)
# Per student per hour, across both channels.
HOURLY_SEND_LIMIT = 5


class OtpError(Exception):
    """A failure with a message the student is meant to read."""

    def __init__(self, detail, *, retry_after=None):
        super().__init__(detail)
        self.detail = detail
        # Seconds until the action is worth retrying, when that is knowable.
        self.retry_after = retry_after


def _generate_code():
    # secrets rather than random: this is a credential, however short lived.
    return f'{secrets.randbelow(10 ** CODE_DIGITS):0{CODE_DIGITS}d}'


def _message(code):
    return (
        f'{code} is your ScholarCircle verification code. '
        f'It expires in {int(CODE_TTL.total_seconds() // 60)} minutes. '
        'If you did not ask for it, ignore this message.'
    )


def _send_sms(number, code):
    try:
        return get_sms_backend().send(number, _message(code)).ok
    except Exception:  # noqa: BLE001 - a gateway must never 500 the endpoint
        logger.exception('OTP SMS send raised')
        return False


def _send_email(user, code):
    """Fallback channel. Deliberately bypasses the email opt-in: this is a
    security code the student asked for seconds ago, not a notification."""
    address = (user.email or '').strip()
    if not address:
        return False
    try:
        from .mailer.backends import get_backend as get_email_backend

        body = (
            f'Your ScholarCircle verification code is {code}.\n\n'
            f'It expires in {int(CODE_TTL.total_seconds() // 60)} minutes. '
            'If you did not ask for it, you can ignore this email.'
        )
        result = get_email_backend().send(
            address,
            'Your ScholarCircle verification code',
            body,
            to_name=user.get_full_name() or user.first_name or '',
        )
        return bool(getattr(result, 'ok', False))
    except Exception:  # noqa: BLE001
        logger.exception('OTP email send raised')
        return False


def request_code(user, raw_phone):
    """Issue a code for ``raw_phone`` and deliver it.

    Returns ``{'channel', 'phone', 'expires_in', 'resend_in'}``. Raises
    :class:`OtpError` for anything the student needs to act on.
    """
    number = to_e164(raw_phone)
    if not number:
        raise OtpError(
            'That does not look like a phone number we can text. '
            'Use a Ghana number such as 0244123456.'
        )

    now = timezone.now()
    recent = PhoneVerification.objects.filter(student=user).first()
    if recent and now - recent.created_at < RESEND_COOLDOWN:
        wait = int((RESEND_COOLDOWN - (now - recent.created_at)).total_seconds()) + 1
        raise OtpError(
            f'A code was just sent. Wait {wait} seconds before asking for another.',
            retry_after=wait,
        )

    hour_ago = now - timedelta(hours=1)
    if PhoneVerification.objects.filter(student=user, created_at__gte=hour_ago).count() >= HOURLY_SEND_LIMIT:
        raise OtpError(
            'Too many codes requested in the last hour. Try again later.',
            retry_after=3600,
        )

    code = _generate_code()

    # Retire any code still outstanding, so exactly one is live at a time and an
    # older message cannot be replayed after a resend.
    PhoneVerification.objects.filter(student=user, consumed_at__isnull=True).update(consumed_at=now)

    channel = 'SMS' if _send_sms(number, code) else ('Email' if _send_email(user, code) else '')
    if not channel:
        raise OtpError(
            'We could not send the code just now. Please try again in a moment.'
        )

    PhoneVerification.objects.create(
        student=user,
        phone=number,
        code_hash=make_password(code),
        channel=channel,
        expires_at=now + CODE_TTL,
    )

    return {
        'channel': channel,
        # Masked: enough to confirm the right handset, not enough to enumerate.
        'phone': number[:-4].rstrip() + '****' if len(number) > 4 else number,
        'expires_in': int(CODE_TTL.total_seconds()),
        'resend_in': int(RESEND_COOLDOWN.total_seconds()),
    }


def verify_code(user, code):
    """Check ``code`` against the student's live verification.

    On success the number is written to the profile and marked verified.
    Raises :class:`OtpError` otherwise.
    """
    code = (code or '').strip()
    if not code.isdigit() or len(code) != CODE_DIGITS:
        raise OtpError(f'Enter the {CODE_DIGITS} digit code we sent you.')

    now = timezone.now()
    record = PhoneVerification.objects.filter(
        student=user, consumed_at__isnull=True
    ).first()
    if record is None:
        raise OtpError('Ask for a code first.')
    if record.expires_at <= now:
        raise OtpError('That code has expired. Ask for a new one.')
    if record.attempts >= MAX_ATTEMPTS:
        raise OtpError('Too many wrong attempts. Ask for a new code.')

    # Count the attempt before checking it, so a crash mid-check cannot be used
    # to guess for free.
    record.attempts += 1
    record.save(update_fields=['attempts'])

    if not check_password(code, record.code_hash):
        left = MAX_ATTEMPTS - record.attempts
        raise OtpError(
            'That code is not right. Ask for a new one.' if left <= 0
            else f'That code is not right. {left} attempt{"s" if left != 1 else ""} left.'
        )

    record.consumed_at = now
    record.save(update_fields=['consumed_at'])

    profile = getattr(user, 'profile', None)
    if profile is not None:
        profile.phone = record.phone
        profile.phone_verified = True
        profile.save(update_fields=['phone', 'phone_verified'])

    return record
