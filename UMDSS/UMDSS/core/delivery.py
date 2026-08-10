"""Shared vocabulary for outbound delivery backends.

Both the SMS gateway and the email provider answer the same question — did it
go, and what is the provider's handle for it — so they answer it in the same
shape.
"""

import os
from dataclasses import dataclass

from django.conf import settings


def looks_like_production():
    """True when this process is probably serving real users.

    ``DEBUG`` alone is not enough to decide this: Django forces ``DEBUG`` off
    while running tests, so keying on it would make the whole suite complain
    about every console send. Requiring a managed database as well keeps the
    signal honest — a laptop runs on sqlite with no ``DATABASE_URL``, Render
    always has one.
    """
    return not settings.DEBUG and bool(os.environ.get('DATABASE_URL'))


@dataclass(frozen=True)
class SendResult:
    """What a provider said. ``ok`` is the only thing callers must branch on."""
    ok: bool
    provider_message_id: str = ''
    error: str = ''

    @classmethod
    def failure(cls, error):
        # Provider errors land in a CharField and get shown in the admin, so
        # keep them short enough to stay readable.
        return cls(ok=False, error=str(error)[:300])
