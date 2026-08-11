"""Remove every scholarship the app is not allowed to show.

The authenticity rule is: a student only ever sees a scholarship that was
scraped from a live page we can link back to. This command enforces that on the
stored data by deleting anything that fails the same `Scholarship.objects
.verifiable()` gate the API uses — demo fixtures (origin='seeded'), unverified
curated fallbacks (origin='curated'), and any row missing its source_url.

Safety:
  * Dry run by default. It prints exactly what it would remove and changes
    nothing. Pass --apply to delete.
  * Before deleting, it writes a JSON backup of every row it is about to remove
    (and the count of MatchResults that will cascade), so a mistake is
    recoverable. Override the path with --backup, or skip with --no-backup.
  * After deleting it regenerates matches for every student, so the /matches/
    endpoint is consistent immediately rather than at the next scrape.

Deleting a Scholarship cascades to its MatchResults and Applications, so a
student who had started an application against a demo row loses it — which is
correct: that row should never have been applyable.
"""
import datetime
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q

from core.models import Application, MatchResult, Scholarship


class Command(BaseCommand):
    help = "Delete scholarships that fail the verifiable() provenance gate."

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply', action='store_true',
            help='Actually delete. Without this the command only reports.',
        )
        parser.add_argument(
            '--backup', default='',
            help='Where to write the JSON backup of removed rows. '
                 'Defaults to purge_unverified_backup_<timestamp>.json in the cwd.',
        )
        parser.add_argument(
            '--no-backup', action='store_true',
            help='Skip writing the JSON backup (not recommended).',
        )

    def handle(self, *args, **options):
        # The inverse of Scholarship.objects.verifiable(): anything not scraped,
        # or scraped but without a source_url to trace it back to.
        unverified = Scholarship.objects.filter(
            Q(source_url='') | ~Q(origin='scraped')
        )

        total = Scholarship.objects.count()
        verifiable = Scholarship.objects.verifiable().count()
        doomed = list(unverified)

        self.stdout.write(f'Scholarships in database:        {total}')
        self.stdout.write(f'Verifiable (kept):               {verifiable}')
        self.stdout.write(f'Unverified (to remove):          {len(doomed)}')

        if not doomed:
            self.stdout.write(self.style.SUCCESS('\nNothing to remove — catalogue is already clean.'))
            return

        # Group the removals by why they fail, so the report is legible.
        by_origin = {}
        for s in doomed:
            reason = s.origin if s.origin != 'scraped' else 'scraped (no source_url)'
            by_origin.setdefault(reason, []).append(s)

        self.stdout.write('')
        for reason, rows in sorted(by_origin.items()):
            self.stdout.write(self.style.WARNING(f'{reason}: {len(rows)}'))
            for s in rows:
                dl = s.deadline.isoformat() if s.deadline else 'no deadline'
                self.stdout.write(f'  - {s.name[:55]:<55} [{dl}]')

        doomed_ids = [s.id for s in doomed]
        match_count = MatchResult.objects.filter(scholarship_id__in=doomed_ids).count()
        app_count = Application.objects.filter(scholarship_id__in=doomed_ids).count()
        self.stdout.write('')
        self.stdout.write(f'Cascading deletes: {match_count} match(es), {app_count} application(s).')

        if not options['apply']:
            self.stdout.write(self.style.WARNING('\nDry run. Re-run with --apply to delete.'))
            return

        # ── Backup before deleting ────────────────────
        if not options['no_backup']:
            stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
            path = Path(options['backup'] or f'purge_unverified_backup_{stamp}.json')
            payload = {
                'generated_at': datetime.datetime.now().isoformat(),
                'removed_scholarships': [
                    self._dump(s) for s in doomed
                ],
                'cascaded_match_count': match_count,
                'cascaded_application_count': app_count,
            }
            path.write_text(
                json.dumps(payload, indent=2, cls=DjangoJSONEncoder, ensure_ascii=False),
                encoding='utf-8',
            )
            self.stdout.write(self.style.SUCCESS(f'\nBackup written: {path.resolve()}'))

        # ── Delete ────────────────────────────────────
        deleted, _ = unverified.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} object(s) total (rows + cascades).'))

        # ── Rebuild matches so /matches/ is consistent now ──
        self._regenerate_matches()

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Scholarships remaining: {Scholarship.objects.count()} '
            f'(all verifiable).'
        ))

    @staticmethod
    def _dump(s):
        """A restorable snapshot of a scholarship row."""
        return {
            f.name: getattr(s, f.name)
            for f in Scholarship._meta.fields
        }

    def _regenerate_matches(self):
        from core.matching import regenerate_matches_for_user
        from core.models import StudentProfile

        n = 0
        for profile in StudentProfile.objects.select_related('user'):
            try:
                regenerate_matches_for_user(profile.user)
                n += 1
            except Exception as e:  # pragma: no cover - defensive
                self.stderr.write(f'  match rebuild failed for {profile.user}: {e}')
        self.stdout.write(f'Recomputed matches for {n} student(s).')
