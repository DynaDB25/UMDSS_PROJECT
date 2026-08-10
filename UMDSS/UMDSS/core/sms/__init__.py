"""SMS delivery for student alerts.

Feature code normally wants :func:`core.notifications.notify`, which writes the
in-app alert and fans out to every channel the student accepts. Reach for
:func:`send_sms` only when a text is the whole point.
"""

from .backends import ConsoleSmsBackend, SendResult, SmsBackend, get_backend
from .dispatch import send_sms
from .phone import to_e164

__all__ = [
    'ConsoleSmsBackend',
    'SendResult',
    'SmsBackend',
    'get_backend',
    'send_sms',
    'to_e164',
]
