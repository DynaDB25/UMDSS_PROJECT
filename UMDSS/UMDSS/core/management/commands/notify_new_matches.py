"""Text students when a new Strong match appears.

Kept out of ``regenerate_matches_for_user`` on purpose. That function runs on
every profile save, every scrape and a couple of data migrations, so sending
from inside it would text a student each time they corrected a typo in their
programme. Instead this command runs on a schedule and treats the SmsMessage
log as the record of what has already been announced: the ``dedupe_key`` is
unique per student and scholarship, so each match is announced exactly once and
never again.

Run ``--mark-only`` once before the first real run. Without it, a database that
already holds strong matches would text every student about every one of them
the first time this executes.
"""

from django.core.management.base import BaseCommand

from core.models import MatchResult, OutboundMessage
from core.notifications import notify

NAME_LIMIT = 60

# Nobody wants six texts in one morning because a scrape landed six awards they
# happen to qualify for. The rest still appear in the app and in the in-app
# alerts; only the texting is rationed.
DEFAULT_MAX_PER_STUDENT = 2


def _short(name):
    name = ' '.join(str(name).split())
    if len(name) <= NAME_LIMIT:
        return name
    return name[:NAME_LIMIT - 1].rstrip() + '.'


class Command(BaseCommand):
    help = 'Text students about Strong matches they have not been told about yet.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--mark-only', action='store_true',
            help='Record every current strong match as already announced, without '
                 'sending anything. Run this once when first deploying SMS.')
        parser.add_argument(
            '--max-per-student', type=int, default=DEFAULT_MAX_PER_STUDENT,
            help=f'Cap texts per student per run. Default: {DEFAULT_MAX_PER_STUDENT}.')
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--ignore-quiet-hours', action='store_true')
        parser.add_argument('--user', type=str, help='Limit to one username.')

    def handle(self, *args, **options):
        matches = MatchResult.objects.filter(
            status='Strong match').select_related('student', 'scholarship')
        if options.get('user'):
            matches = matches.filter(student__username__icontains=options['user'])

        # One query for everything already announced, rather than one per match.
        # A key present on either channel counts as announced: the point is that
        # a student hears about a match once, not once per channel.
        announced = set(
            OutboundMessage.objects.filter(dedupe_key__startswith='match:')
            .values_list('dedupe_key', flat=True))

        per_student = {}
        counts = {'Sent': 0, 'Failed': 0, 'Skipped': 0, 'Queued': 0}
        marked = considered = 0

        for match in matches.order_by('-score'):
            key = f'match:{match.student_id}:{match.scholarship_id}'
            if key in announced:
                continue
            considered += 1

            if options['mark_only']:
                # A row per channel claims the key on both, so the next real run
                # treats this match as old news everywhere. The uniqueness index
                # is scoped per channel, so one row would only block one of them.
                for channel in ('SMS', 'Email'):
                    OutboundMessage.objects.create(
                        student=match.student, channel=channel, body='',
                        status='Skipped', dedupe_key=key,
                        error='pre-existing match, not announced')
                marked += 1
                continue

            used = per_student.get(match.student_id, 0)
            if used >= options['max_per_student']:
                continue

            name = _short(match.scholarship.name)
            sms_text = (f'ScholarCircle: You are a strong match ({match.score}%) for {name}. '
                        f'Open the app to see why and apply.')

            if options['dry_run']:
                self.stdout.write(f'[dry-run] {match.student.username} <- {sms_text}')
                per_student[match.student_id] = used + 1
                continue

            _, delivery = notify(
                match.student,
                category='Match',
                title=f'New strong match: {match.scholarship.name}',
                body=(f'You scored {match.score}% against this {match.scholarship.provider} '
                      f'award, which makes you a strong match. Open it to see the criteria '
                      f'you meet and start an application.'),
                sms_text=sms_text,
                email=True,
                dedupe_key=key,
                ignore_quiet_hours=options['ignore_quiet_hours'],
            )
            per_student[match.student_id] = used + 1
            for message in (delivery.sms, delivery.email):
                if message is not None:
                    counts[message.status] = counts.get(message.status, 0) + 1

        if options['mark_only']:
            self.stdout.write(self.style.SUCCESS(
                f'Marked {marked} existing strong match(es) as already announced.'))
            return
        if options['dry_run']:
            self.stdout.write(self.style.SUCCESS(
                f'{considered} new strong match(es); '
                f'{sum(per_student.values())} would be texted.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f"{considered} new strong match(es): sent={counts['Sent']} "
            f"failed={counts['Failed']} skipped={counts['Skipped']}"))
