"""Pluggable SMS gateways.

The backend is chosen at runtime from settings, so a machine without
``ARKESEL_API_KEY`` — every dev laptop, and CI — physically cannot spend
credits. :class:`ConsoleSmsBackend` logs what it would have sent and reports
success, which exercises every code path above it for free.
"""

import logging

from django.conf import settings

from core.delivery import SendResult, looks_like_production

from .phone import for_wire

logger = logging.getLogger('sms')

ARKESEL_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send'


class SmsBackend:
    """Send one message to one number."""

    def send(self, to_e164_number, message):  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleSmsBackend(SmsBackend):
    """The default. Logs the message and claims success without a network call."""

    def send(self, to_e164_number, message):
        logger.info('[sms:console] to=%s body=%r', to_e164_number, message)
        return SendResult(ok=True, provider_message_id='console')


class ArkeselSmsBackend(SmsBackend):
    """Arkesel V2: POST /api/v2/sms/send with an ``api-key`` header."""

    def __init__(self, api_key=None, sender_id=None, timeout=None):
        self.api_key = api_key or settings.ARKESEL_API_KEY
        self.sender_id = sender_id or settings.ARKESEL_SENDER_ID
        self.timeout = timeout or settings.SMS_TIMEOUT_SECONDS

    def send(self, to_e164_number, message):
        # Imported here so that merely importing this module — which the
        # dispatch layer does unconditionally — never needs requests present.
        import requests

        if not self.api_key:
            return SendResult.failure('ARKESEL_API_KEY is not set')

        payload = {
            'sender': self.sender_id,
            'message': message,
            'recipients': [for_wire(to_e164_number)],
        }
        try:
            response = requests.post(
                ARKESEL_SEND_URL,
                json=payload,
                headers={'api-key': self.api_key, 'Content-Type': 'application/json'},
                timeout=self.timeout,
            )
        except Exception as exc:
            # Connection reset, DNS failure, timeout. The caller records the
            # error and moves to the next recipient rather than dying halfway
            # through a batch.
            return SendResult.failure(f'{type(exc).__name__}: {exc}')

        if response.status_code != 200:
            # 401 invalid key, 422 unregistered sender ID or bad number, 400
            # malformed. The body carries the detail worth keeping.
            return SendResult.failure(f'HTTP {response.status_code}: {response.text}')

        try:
            body = response.json()
        except ValueError:
            return SendResult.failure(f'Non-JSON response: {response.text}')

        if str(body.get('status', '')).lower() != 'success':
            return SendResult.failure(body.get('message') or response.text)

        return SendResult(ok=True, provider_message_id=_message_id(body))


def _message_id(body):
    """Pull the provider's reference out of a ``data`` field of either shape.

    Arkesel documents ``data`` as an object (``{"id": ...}``) in one place and
    as a per-recipient array in another. We send one recipient at a time, so
    either way there is exactly one id to find, and an id we fail to parse is
    not worth failing an otherwise successful send over.
    """
    data = body.get('data')
    if isinstance(data, list):
        data = data[0] if data else None
    if isinstance(data, dict):
        return str(data.get('id') or data.get('message_id') or '')[:120]
    return ''


def get_backend():
    """Build the configured backend. Anything unrecognised falls back to console."""
    name = (settings.SMS_BACKEND or 'console').lower()
    if name == 'arkesel':
        return ArkeselSmsBackend()
    if name != 'console':
        logger.warning('Unknown SMS_BACKEND %r; falling back to console.', name)
    if looks_like_production():
        # The console backend reports success, so without this the delivery log
        # on a misconfigured deploy fills with rows marked Sent that never
        # reached a phone, and nothing anywhere says otherwise.
        logger.warning(
            'SMS_BACKEND is "console" on what looks like a deployed environment. '
            'Messages will be recorded as Sent but no text will reach anyone. '
            'Set SMS_BACKEND=arkesel and ARKESEL_API_KEY.')
    return ConsoleSmsBackend()
