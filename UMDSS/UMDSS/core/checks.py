"""Startup checks for the notification channels.

These run on ``manage.py check``, so putting that in Render's build command
turns a missing key into a message at deploy time rather than a silent
non-delivery discovered weeks later by a student who never got their reminder.

Everything here stays quiet unless the process looks deployed — a laptop and
the test suite are both supposed to run on the console backends.
"""

from django.conf import settings
from django.core.checks import Warning as CheckWarning
from django.core.checks import register

from .delivery import looks_like_production

# Alphanumeric sender IDs are capped at 11 characters by GSM 03.38. Anything
# longer is rejected at registration rather than at send time, so it is worth
# saying out loud before somebody waits two weeks on a carrier approval that
# was never going to succeed.
SENDER_ID_MAX_LENGTH = 11


@register()
def delivery_backends_are_configured(app_configs, **kwargs):
    if not looks_like_production():
        return []

    problems = []

    if (settings.SMS_BACKEND or 'console').lower() == 'console':
        problems.append(CheckWarning(
            'SMS_BACKEND is "console", so no text will ever be sent.',
            hint='Console sends are recorded as Sent, so the delivery log will '
                 'look healthy while nothing arrives. Set SMS_BACKEND=arkesel '
                 'with ARKESEL_API_KEY, or set SMS_ENABLED=false to say plainly '
                 'that texting is off.',
            id='core.W001',
        ))
    elif not settings.ARKESEL_API_KEY:
        problems.append(CheckWarning(
            'SMS_BACKEND is "arkesel" but ARKESEL_API_KEY is empty.',
            hint='Every send will fail until the key is set.',
            id='core.W002',
        ))

    if len(settings.ARKESEL_SENDER_ID) > SENDER_ID_MAX_LENGTH:
        problems.append(CheckWarning(
            f'ARKESEL_SENDER_ID is {len(settings.ARKESEL_SENDER_ID)} characters; '
            f'the GSM limit is {SENDER_ID_MAX_LENGTH}.',
            hint='A longer alphanumeric sender ID cannot be registered.',
            id='core.W003',
        ))

    if (settings.EMAIL_PROVIDER or 'console').lower() == 'console':
        problems.append(CheckWarning(
            'EMAIL_PROVIDER is "console", so no mail will ever be sent.',
            hint='Set EMAIL_PROVIDER=brevo with BREVO_API_KEY and '
                 'BREVO_SENDER_EMAIL, or set EMAIL_ENABLED=false.',
            id='core.W004',
        ))
    else:
        if not settings.BREVO_API_KEY:
            problems.append(CheckWarning(
                'EMAIL_PROVIDER is "brevo" but BREVO_API_KEY is empty.',
                hint='Every send will fail until the key is set.',
                id='core.W005',
            ))
        if not settings.BREVO_SENDER_EMAIL:
            problems.append(CheckWarning(
                'EMAIL_PROVIDER is "brevo" but BREVO_SENDER_EMAIL is empty.',
                hint='Brevo rejects a send with no sender, and the address must '
                     'be one it has verified.',
                id='core.W006',
            ))

    return problems
