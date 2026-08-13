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

Email carries the code, SMS is the second choice. That looks backwards for a
phone verification, and it is: Arkesel will not carry an alphanumeric sender ID
until the NCA approves it, so every text currently fails. Leading with SMS
meant every student waited on a send that was never going to arrive and then
read that we had emailed a code to their phone number. Email is offered first
because it is the channel that actually delivers; SMS stays one click away, and
becomes the sane default the day the sender ID clears.
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

CHANNEL_SMS = 'SMS'
CHANNEL_EMAIL = 'Email'
# See the module docstring: email leads only because SMS cannot deliver yet.
# Flip this to CHANNEL_SMS once the Arkesel sender ID clears the NCA, and the
# whole flow follows, including which option the screen offers second.
PRIMARY_CHANNEL = CHANNEL_EMAIL

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
    """Deliberately bypasses the email opt-in: this is a security code the
    student asked for seconds ago, not a notification."""
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


def _destination(user, channel, number):
    """Where a code sent on ``channel`` would land, or '' if it has nowhere."""
    if channel == CHANNEL_EMAIL:
        return (user.email or '').strip()
    return number


def _mask(channel, destination):
    """Enough of the destination to recognise, not enough to enumerate.

    Masked per channel, because the screen prints this back verbatim: an
    address that came from the email branch can never be announced as a phone
    number, which is exactly the confusion this replaces.
    """
    if channel == CHANNEL_EMAIL:
        local, at, domain = destination.partition('@')
        if not at:
            return destination
        shown = local[:2] if len(local) > 3 else local[:1]
        return f'{shown}{"*" * max(len(local) - len(shown), 3)}@{domain}'
    if len(destination) > 4:
        return destination[:-4] + '****'
    return destination


def _deliver(user, channel, number, code):
    return _send_email(user, code) if channel == CHANNEL_EMAIL else _send_sms(number, code)


def _preferred(channel):
    """Normalise the student's pick. Anything unrecognised means 'no pick'."""
    wanted = str(channel or '').strip().lower()
    if wanted in ('sms', 'text'):
        return CHANNEL_SMS
    if wanted in ('email', 'mail'):
        return CHANNEL_EMAIL
    return PRIMARY_CHANNEL


def request_code(user, raw_phone, channel=None):
    """Issue a code for ``raw_phone`` and deliver it.

    ``channel`` is the student's explicit pick, 'sms' or 'email'; without one
    the code goes by :data:`PRIMARY_CHANNEL`. Either way the other channel is
    tried if the first refuses, so a gateway outage strands nobody.

    Returns ``{'channel', 'sent_to', 'phone', 'alt_channel', 'expires_in',
    'resend_in'}``. ``sent_to`` is masked and always belongs to ``channel``.
    Raises :class:`OtpError` for anything the student needs to act on.
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

    wanted = _preferred(channel)
    other = CHANNEL_SMS if wanted == CHANNEL_EMAIL else CHANNEL_EMAIL

    sent_on = ''
    for candidate in (wanted, other):
        destination = _destination(user, candidate, number)
        # No address on the account is not a failure worth reporting, it just
        # means that channel is not a route for this student.
        if destination and _deliver(user, candidate, number, code):
            sent_on = candidate
            break

    if not sent_on:
        raise OtpError(
            'We could not send the code just now. Please try again in a moment.'
        )

    # Retire any code still outstanding, so exactly one is live at a time and an
    # older message cannot be replayed after a resend. Done only once the new
    # code is away: a student switching channels should not lose the code
    # already in their inbox to a send that then fails.
    PhoneVerification.objects.filter(student=user, consumed_at__isnull=True).update(consumed_at=now)

    PhoneVerification.objects.create(
        student=user,
        phone=number,
        code_hash=make_password(code),
        channel=sent_on,
        expires_at=now + CODE_TTL,
    )

    alt = CHANNEL_SMS if sent_on == CHANNEL_EMAIL else CHANNEL_EMAIL
    return {
        'channel': sent_on,
        'sent_to': _mask(sent_on, _destination(user, sent_on, number)),
        # The number being verified, whichever channel carried the code.
        'phone': _mask(CHANNEL_SMS, number),
        # What the screen offers as the second way in, once the cooldown is up.
        # None when the student has no address on that channel to send to.
        'alt_channel': alt if _destination(user, alt, number) else None,
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
