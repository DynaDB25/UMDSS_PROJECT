from django.core.management.base import BaseCommand
from core.models import StudentProfile, MatchResult
from core.matching import regenerate_matches_for_user


class Command(BaseCommand):
    help = 'Recompute MatchResult rows for every student profile against every scholarship.'

    def add_arguments(self, parser):
        parser.add_argument('--user', type=str, help='Limit to one username.')

    def handle(self, *args, **options):
        profiles = StudentProfile.objects.select_related('user')
        if options['user']:
            profiles = profiles.filter(user__username__icontains=options['user'])
            if not profiles.exists():
                self.stderr.write(f"No profile matching '{options['user']}'.")
                return

        for profile in profiles:
            completion = regenerate_matches_for_user(profile.user)
            matches = MatchResult.objects.filter(student=profile.user)
            self.stdout.write(self.style.SUCCESS(
                f'{profile.user.username}: {matches.count()} matches '
                f"(strong={matches.filter(status='Strong match').count()}, "
                f"partial={matches.filter(status='Partial match').count()}, "
                f"not eligible={matches.filter(status='Not eligible').count()}) "
                f'| profile {completion}% complete'
            ))
