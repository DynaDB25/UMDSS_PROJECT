from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from core.models import Scholarship

# The demo account created by the seed_data command, along with its fabricated
# applications, vault documents and notifications. Real accounts are untouched.
DEMO_USERNAME = 'benjamin.darko@st.knust.edu.gh'


class Command(BaseCommand):
    help = "Remove seed_data's demo fixtures (demo user and origin='seeded' scholarships)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Actually delete. Without this the command only reports what it would remove.',
        )

    def handle(self, *args, **options):
        seeded = Scholarship.objects.filter(origin='seeded')
        demo = User.objects.filter(username=DEMO_USERNAME)

        self.stdout.write(f'Seeded scholarships to remove: {seeded.count()}')
        for s in seeded:
            self.stdout.write(f'  - {s.name}')

        if demo.exists():
            u = demo.first()
            self.stdout.write(f'\nDemo account to remove: {u.username}')
            self.stdout.write(
                '  cascades: '
                f'{u.matches.count()} match(es), '
                f'{u.applications.count()} application(s), '
                f'{u.vault_documents.count()} document(s), '
                f'{u.notifications.count()} notification(s)'
            )
        else:
            self.stdout.write('\nDemo account: already absent.')

        kept = User.objects.exclude(username=DEMO_USERNAME)
        self.stdout.write(f'\nAccounts kept ({kept.count()}):')
        for u in kept:
            self.stdout.write(f'  + {u.username}')

        if not options['apply']:
            self.stdout.write(self.style.WARNING('\nDry run. Re-run with --apply to delete.'))
            return

        n_sch = seeded.count()
        seeded.delete()
        n_user = demo.count()
        demo.delete()

        self.stdout.write(self.style.SUCCESS(
            f'\nDeleted {n_sch} seeded scholarship(s) and {n_user} demo account(s).'
        ))
        self.stdout.write(f'Scholarships remaining: {Scholarship.objects.count()}')
        self.stdout.write(f'Accounts remaining: {User.objects.count()}')
