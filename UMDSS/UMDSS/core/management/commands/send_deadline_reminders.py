"""Text students whose deadlines are about to pass.

Scheduled from .github/workflows/daily-scrape.yml, not from Celery beat. This
deployment sets ``CELERY_TASK_ALWAYS_EAGER`` and runs neither a worker nor a
beat process, so everything in ``CELERY_BEAT_SCHEDULE`` never fires; the
workflow is the only thing here that actually runs on a clock.

Two kinds of reminder go out, both only to students who can still act on them:

* an application still sitting in Draft, and
* a Strong match the student has not applied to at all.

Partial matches are deliberately left alone. The matching engine caps
unverified scholarships at Partial, so texting about one would spend a credit
on eligibility we cannot stand behind.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Application, MatchResult, Scholarship
from core.notifications import notify

# Far enough out to gather documents, a nudge, then a last call.
REMINDER_DAYS = (7, 3, 1)

# Award names run long — the catalogue holds several over 120 characters — and
# a single text has 160 to spend in total.
NAME_LIMIT = 55


def _short(name):
    name = ' '.join(str(name).split())
    if len(name) <= NAME_LIMIT:
        return name
    return name[:NAME_LIMIT - 1].rstrip() + '.'


class Command(BaseCommand):
    help = 'Text students about scholarship deadlines falling due in 7, 3 or 1 days.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, nargs='+', default=list(REMINDER_DAYS),
            help='Days-before-deadline to remind on. Default: 7 3 1.')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Print who would be texted and send nothing.')
        parser.add_argument(
            '--ignore-quiet-hours', action='store_true',
            help='Send even inside the do-not-disturb window.')
        parser.add_argument('--user', type=str, help='Limit to one username.')

    def handle(self, *args, **options):
        today = timezone.localdate()
        dry_run = options['dry_run']
        counts = {'Sent': 0, 'Failed': 0, 'Skipped': 0, 'Queued': 0}
        planned = 0

        # Longest warning first, so that a scholarship somehow matching two
        # windows leads with the more useful message.
        for days in sorted(set(options['days']), reverse=True):
            due = today + timedelta(days=days)
            for scholarship in Scholarship.objects.filter(deadline=due):
                for student, kind in self._recipients(scholarship, options.get('user')):
                    planned += 1
                    title, body, sms_text = self._compose(scholarship, days, due, kind)
                    if dry_run:
                        self.stdout.write(f'[dry-run] {student.username} <- {sms_text}')
                        continue

                    _, delivery = notify(
                        student,
                        category='Deadline',
                        title=title,
                        body=body,
                        sms_text=sms_text,
                        email=True,
                        dedupe_key=f'deadline:{kind}:{student.id}:{scholarship.id}:{days}',
                        ignore_quiet_hours=options['ignore_quiet_hours'],
                    )
                    for channel, message in (('SMS', delivery.sms), ('Email', delivery.email)):
                        if message is None:
                            continue
                        counts[message.status] = counts.get(message.status, 0) + 1
                        if message.status in ('Failed', 'Skipped'):
                            self.stdout.write(
                                f'  {student.username} {channel}: '
                                f'{message.status} - {message.error}')

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'{planned} reminder(s) would be sent.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f"{planned} reminder(s) considered, {sum(counts.values())} deliveries: "
            f"sent={counts['Sent']} failed={counts['Failed']} skipped={counts['Skipped']}"))

    def _recipients(self, scholarship, username):
        """Yield ``(user, kind)`` for everyone worth texting about this award."""
        drafts = Application.objects.filter(
            scholarship=scholarship, status='Draft').select_related('student')
        if username:
            drafts = drafts.filter(student__username__icontains=username)

        seen = set()
        for application in drafts:
            seen.add(application.student_id)
            yield application.student, 'draft'

        # Anyone who already has an application of any status has been told
        # about this award by the tracker; only the untouched strong matches
        # need the nudge.
        applied = set(Application.objects.filter(
            scholarship=scholarship).values_list('student_id', flat=True))
        strong = MatchResult.objects.filter(
            scholarship=scholarship, status='Strong match'
        ).exclude(student_id__in=applied | seen).select_related('student')
        if username:
            strong = strong.filter(student__username__icontains=username)

        for match in strong:
            yield match.student, 'match'

    def _compose(self, scholarship, days, due, kind):
        """Build the in-app alert and the text.

        The SMS body stays plain ASCII on purpose: one curly quote or dash
        would push the whole message from GSM-7 into UCS-2, cutting the segment
        from 160 characters to 70 and doubling what it costs to send.
        """
        when = f'in {days} day' if days == 1 else f'in {days} days'
        pretty_due = due.strftime('%d %b')
        name = _short(scholarship.name)

        if kind == 'draft':
            title = f'Closing {when}: {scholarship.name}'
            body = (f'Your application to {scholarship.provider} is still a draft and the '
                    f'deadline is {pretty_due}. Finish it and mark it submitted to keep '
                    f'it on track.')
            sms_text = (f'ScholarCircle: {name} closes {when} ({pretty_due}). Your application is '
                        f'still a draft. Open the app to finish it.')
        else:
            title = f'Closing {when}: {scholarship.name}'
            body = (f'You are a strong match for this {scholarship.provider} award and have '
                    f'not applied. The deadline is {pretty_due}.')
            sms_text = (f'ScholarCircle: {name} closes {when} ({pretty_due}). You are a strong match '
                        f'and have not applied yet.')

        return title, body, sms_text
