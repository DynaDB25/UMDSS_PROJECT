"""Pluggable email providers.

Mirrors :mod:`core.sms.backends`: the provider is chosen at runtime from
settings, so a machine without ``BREVO_API_KEY`` — every dev laptop, and CI —
physically cannot send real mail. :class:`ConsoleEmailBackend` logs what it
would have sent and reports success, which exercises every code path above it.
"""

import html
import logging

from django.conf import settings

from core.delivery import SendResult, looks_like_production

logger = logging.getLogger('mailer')

BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'


def render_html(subject, body):
    """Wrap a plain-text alert in deliberately boring HTML.

    No images, no external stylesheets, no web fonts: mail clients block remote
    content by default, and anything that has to load from elsewhere either
    fails to render or trips spam heuristics. Inline styles only, because Gmail
    strips <style> blocks.
    """
    paragraphs = ''.join(
        f'<p style="margin:0 0 14px;line-height:1.55;">{html.escape(part)}</p>'
        for part in str(body).split('\n') if part.strip()
    )
    return (
        '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;'
        'color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">'
        f'<h1 style="font-size:18px;margin:0 0 16px;">{html.escape(str(subject))}</h1>'
        f'{paragraphs}'
        '<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px;">'
        '<p style="font-size:12px;color:#6b6b6b;margin:0;">'
        'You are receiving this because you signed up for scholarship alerts on UMDSS. '
        'Turn these emails off under Settings in the app.'
        '</p>'
        '</div>'
    )


class EmailBackend:
    """Send one message to one address."""

    def send(self, to_address, subject, body, to_name=''):  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleEmailBackend(EmailBackend):
    """The default. Logs the message and claims success without a network call."""

    def send(self, to_address, subject, body, to_name=''):
        logger.info('[email:console] to=%s subject=%r body=%r', to_address, subject, body)
        return SendResult(ok=True, provider_message_id='console')


class BrevoEmailBackend(EmailBackend):
    """Brevo transactional email: POST /v3/smtp/email with an ``api-key`` header."""

    def __init__(self, api_key=None, sender_email=None, sender_name=None, timeout=None):
        self.api_key = api_key or settings.BREVO_API_KEY
        self.sender_email = sender_email or settings.BREVO_SENDER_EMAIL
        self.sender_name = sender_name or settings.BREVO_SENDER_NAME
        self.timeout = timeout or settings.EMAIL_TIMEOUT_SECONDS

    def send(self, to_address, subject, body, to_name=''):
        # Imported here so that merely importing this module — which the
        # dispatch layer does unconditionally — never needs requests present.
        import requests

        if not self.api_key:
            return SendResult.failure('BREVO_API_KEY is not set')
        if not self.sender_email:
            return SendResult.failure('BREVO_SENDER_EMAIL is not set')

        recipient = {'email': to_address}
        if to_name:
            # Brevo caps the display name at 70 characters and rejects longer.
            recipient['name'] = to_name[:70]

        payload = {
            'sender': {'email': self.sender_email, 'name': self.sender_name[:70]},
            'to': [recipient],
            'subject': subject,
            'htmlContent': render_html(subject, body),
            # Sending both parts is what keeps this out of spam folders that
            # score HTML-only mail, and it is what a feature phone will show.
            'textContent': str(body),
        }
        try:
            response = requests.post(
                BREVO_SEND_URL,
                json=payload,
                headers={
                    'api-key': self.api_key,
                    'accept': 'application/json',
                    'content-type': 'application/json',
                },
                timeout=self.timeout,
            )
        except Exception as exc:
            # Connection reset, DNS failure, timeout. The caller records the
            # error and moves to the next recipient rather than dying halfway
            # through a batch.
            return SendResult.failure(f'{type(exc).__name__}: {exc}')

        # 201 created, 202 accepted for a scheduled send. Anything else is a
        # refusal: 401 bad key, 400 unverified sender or malformed address,
        # 402 out of credits on the free plan's 300/day.
        if response.status_code not in (200, 201, 202):
            return SendResult.failure(f'HTTP {response.status_code}: {response.text}')

        try:
            body_json = response.json()
        except ValueError:
            # A 2xx with an unparseable body still means Brevo accepted it, so
            # this is a send we simply cannot label with an id.
            return SendResult(ok=True)

        message_id = body_json.get('messageId') or ''
        if not message_id:
            ids = body_json.get('messageIds')
            if isinstance(ids, list) and ids:
                message_id = ids[0]

        return SendResult(ok=True, provider_message_id=str(message_id)[:120])


def get_backend():
    """Build the configured backend. Anything unrecognised falls back to console."""
    name = (settings.EMAIL_PROVIDER or 'console').lower()
    if name == 'brevo':
        return BrevoEmailBackend()
    if name != 'console':
        logger.warning('Unknown EMAIL_PROVIDER %r; falling back to console.', name)
    if looks_like_production():
        # Same trap as SMS: silence here looks exactly like success in the log.
        logger.warning(
            'EMAIL_PROVIDER is "console" on what looks like a deployed environment. '
            'Messages will be recorded as Sent but no mail will reach anyone. '
            'Set EMAIL_PROVIDER=brevo and BREVO_API_KEY.')
    return ConsoleEmailBackend()
