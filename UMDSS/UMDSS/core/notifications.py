"""One alert, delivered on every channel the student accepts.

:func:`notify` is the entry point for feature code. It always writes the in-app
``Notification`` — that alert costs nothing and the student sees it next time
they open the app — then fans out to SMS and email, each of which decides for
itself whether it is allowed to send.

The two channels are not interchangeable. SMS reaches a student with no data
bundle and costs real credits per message, so it carries a short summary and is
rationed. Email is nearly free and has no length limit, so it carries the full
body. Both are recorded in the same log.
"""

from dataclasses import dataclass
from typing import Optional

from core.mailer import send_email
from core.sms import send_sms


@dataclass
class Delivery:
    """What happened on each channel. ``None`` means the channel was not tried."""
    sms: Optional[object] = None
    email: Optional[object] = None

    @property
    def sent_channels(self):
        """Channel names that genuinely reached the provider, SMS first."""
        return [
            name for name, message in (('SMS', self.sms), ('Email', self.email))
            if message is not None and message.status == 'Sent'
        ]


def notify(student, *, category, title, body, sms_text=None, email=False,
           dedupe_key='', ignore_quiet_hours=False, time='Just now'):
    """Write the in-app alert, then deliver it on the channels asked for.

    ``sms_text`` is the short form for a text; pass ``email=True`` to also send
    the full ``title``/``body`` as mail. The same ``dedupe_key`` is safe to use
    for both, because the uniqueness index is scoped per channel.

    ``Notification.channel`` is set from what actually happened — ``'SMS'`` or
    ``'Email'`` only when that provider accepted the message, ``'System'``
    otherwise. Until this existed the field was a label nobody checked, and the
    notifications screen claimed texts that had never been sent.
    """
    from core.models import Notification

    notification = Notification.objects.create(
        student=student, channel='System', category=category,
        title=title, body=body, time=time)

    delivery = Delivery()
    if sms_text:
        delivery.sms = send_sms(
            student, sms_text, notification=notification,
            dedupe_key=dedupe_key, ignore_quiet_hours=ignore_quiet_hours)
    if email:
        delivery.email = send_email(
            student, title, body, notification=notification, dedupe_key=dedupe_key)

    # SMS wins the label when both land: it is the channel the student is most
    # likely to have actually seen.
    sent = delivery.sent_channels
    if sent:
        notification.channel = sent[0]
        notification.save(update_fields=['channel'])

    return notification, delivery
