"""Email delivery for student alerts.

Named ``mailer`` rather than ``email`` on purpose: a package called
``core.email`` invites confusion with the standard library's ``email`` module
for anyone reading an import list.

Feature code normally wants :func:`core.notifications.notify`, which writes the
in-app alert and fans out to every channel the student accepts.
"""

from .backends import BrevoEmailBackend, ConsoleEmailBackend, EmailBackend, get_backend
from .dispatch import send_email

__all__ = [
    'BrevoEmailBackend',
    'ConsoleEmailBackend',
    'EmailBackend',
    'get_backend',
    'send_email',
]
