"""Send one real SMS and print exactly what the gateway said.

The delivery pipeline is deliberately forgiving: a failed send is recorded and
the batch carries on, so a misconfigured gateway shows up as rows in a table
rather than as an error anyone notices. This command is the opposite. It sends
one message, to one number, right now, and prints the provider's own response,
which is the quickest way to tell an unregistered sender ID from a bad API key
from an account with no credits.

    python manage.py test_sms +233XXXXXXXXX
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.sms.backends import get_backend
from core.sms.phone import to_e164


class Command(BaseCommand):
    help = 'Send a single test SMS and report the gateway response verbatim.'

    def add_arguments(self, parser):
        parser.add_argument('phone', help='Recipient, e.g. 0244123456 or +233244123456')
        parser.add_argument(
            '--message',
            default='ScholarCircle test message. If you received this, SMS is working.',
        )

    def handle(self, *args, **options):
        number = to_e164(options['phone'])
        if not number:
            raise CommandError(
                f"{options['phone']!r} is not a phone number we can send to. "
                'Use a Ghana number such as 0244123456 or +233244123456.'
            )

        backend = get_backend()
        self.stdout.write('Gateway:   ' + type(backend).__name__)
        self.stdout.write('Sender ID: ' + (settings.ARKESEL_SENDER_ID or '(unset)'))
        self.stdout.write('API key:   ' + ('set' if settings.ARKESEL_API_KEY else 'NOT SET'))
        self.stdout.write('Enabled:   ' + ('yes' if settings.SMS_ENABLED else 'no (SMS_ENABLED=false)'))
        self.stdout.write('To:        ' + number)

        if settings.SMS_BACKEND == 'console':
            self.stdout.write(self.style.WARNING(
                '\nSMS_BACKEND is "console", so nothing will actually be texted. '
                'Set ARKESEL_API_KEY (or SMS_BACKEND=arkesel) to send for real.'
            ))

        result = backend.send(number, options['message'])

        if result.ok:
            self.stdout.write(self.style.SUCCESS(
                f'\nAccepted by the gateway. Provider id: {result.provider_message_id or "(none returned)"}'
            ))
            self.stdout.write(
                'Accepted means the gateway took it, not that the handset has it yet. '
                'If nothing arrives within a minute or two, the sender ID is the usual cause.'
            )
        else:
            self.stdout.write(self.style.ERROR(f'\nRejected: {result.error}'))
            self.stdout.write(
                'Common causes: 401 means the API key is wrong; 422 usually means the '
                'sender ID is not registered with the networks yet, or the number is '
                'malformed; "insufficient balance" means the account needs credits.'
            )
