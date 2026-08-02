"""Seed real women-only scholarships so the gender-aware matching has live data.

These are genuine programmes for African women, confirmed against the providers'
own sites (waawfoundation.org, thebloomafrica.org). Their *figures* are another
matter: neither publishes a stable award amount or a current deadline that could
be verified here, so every row is marked origin='curated'. That is not a
formality. It makes the app show the "Unverified listing — confirm with the
provider" banner and caps the match at Partial, which is the honest way to
present money and dates we could not confirm. Deadlines are deliberately null
rather than guessed, since a wrong deadline is worse than no deadline.

Idempotent (upsert by slug) and reversible (the reverse removes exactly these
rows). Any failure is swallowed, because seeding data must never break a deploy.
"""
from django.db import migrations


SLUGS = ['waaw-foundation-stem-scholarship', 'bloom-scholars-programme']

# Documents these programmes ask for in practice. Phrased to match the vault's
# document taxonomy (core/documents.py) so auto-attach recognises them.
_COMMON_DOCS = [
    'Academic transcript',
    'Admission letter',
    'Passport photograph',
    'Recommendation letter',
    'Personal statement',
]

STEM_PROGRAMMES = [
    'BSc Computer Engineering', 'BSc Computer Science', 'BSc Electrical Engineering',
    'BSc Mechanical Engineering', 'BSc Civil Engineering', 'BSc Biochemistry',
    'BSc Mathematics', 'BSc Physics', 'BSc Agriculture', 'BSc Nursing',
    'Doctor of Medicine',
]

ROWS = [
    {
        'slug': 'waaw-foundation-stem-scholarship',
        'name': 'WAAW Foundation STEM Scholarship',
        'provider': 'Working to Advance African Women (WAAW) Foundation',
        'provider_type': 'Foundation',
        'logo_color': 'bg-orange-600',
        'initials': 'WAAW',
        'amount': 'Tuition support (amount varies by cohort)',
        'amount_value': 0,
        'deadline': None,
        'region': ['All'],
        'programmes': STEM_PROGRAMMES,
        'max_aggregate': 36,
        'gender_scope': 'female',
        'need_based': True,
        'slots': 50,
        'level_scope': 'tertiary_any',
        'summary': (
            'WAAW Foundation funds African women studying Science, Technology, Engineering '
            'and Mathematics, to widen the pipeline of women in STEM across the continent. '
            'Scholars join a pan-African network and receive leadership and mentoring '
            'support alongside the award. Open to women from across Africa, including '
            'Ghana. Confirm the current award value and deadline on the WAAW site before '
            'you apply.'
        ),
        'benefits': [
            'Tuition support towards a STEM degree',
            'Mentorship from women working in STEM',
            'Access to a pan-African network of scholars',
            'Leadership and entrepreneurship training',
        ],
        'documents': _COMMON_DOCS,
        'tags': ['Women only', 'STEM', 'Undergraduate', 'Pan-African'],
        'source_url': 'https://waawfoundation.org/scholarship/',
        'application_url': 'https://waawfoundation.org/scholarship/',
        'application_mode': 'online',
        'application_email': '',
    },
    {
        'slug': 'bloom-scholars-programme',
        'name': 'The Bloom Scholars Programme',
        'provider': 'The Bloom Africa',
        'provider_type': 'Foundation',
        'logo_color': 'bg-orange-600',
        'initials': 'BSP',
        'amount': 'Tuition support, renewable for up to four years',
        'amount_value': 0,
        'deadline': None,
        'region': ['All'],
        'programmes': ['All'],
        'max_aggregate': 36,
        'gender_scope': 'female',
        'need_based': True,
        'slots': 0,
        'level_scope': 'tertiary_entry',
        'summary': (
            'A tuition scholarship for young African women who are about to begin their '
            'first year of university, with Ghana among the eligible countries. It is '
            'aimed at high-achieving female students who show leadership and a commitment '
            'to their communities, and it is renewable across the degree. Shortlisted '
            'applicants are invited to a short virtual interview. Confirm the current '
            'award value and deadline with The Bloom Africa before you apply.'
        ),
        'benefits': [
            'Tuition support renewable for up to four years',
            'Open to first-year students in Ghana and four other African countries',
            'Community of young African women change-makers',
        ],
        'documents': [
            'Academic transcript',
            'Admission letter',
            'Passport photograph',
            'Personal statement',
        ],
        'tags': ['Women only', 'First year', 'Ghana eligible'],
        'source_url': 'https://thebloomafrica.org/',
        'application_url': 'https://thebloomafrica.org/',
        'application_mode': 'online',
        'application_email': 'hello@thebloomafrica.org',
    },
]


def seed(apps, schema_editor):
    Scholarship = apps.get_model('core', 'Scholarship')
    for row in ROWS:
        try:
            data = dict(row)
            slug = data.pop('slug')
            # 'curated' is doing real work here: it drives the unverified banner
            # and stops the matcher claiming a confident Strong match on figures
            # we could not confirm.
            data['origin'] = 'curated'
            Scholarship.objects.update_or_create(slug=slug, defaults=data)
        except Exception:
            continue  # never fail a deploy over seed data

    # New scholarships mean every student's match set is now incomplete. Refresh
    # it so they show up without waiting for the next profile save or scrape.
    try:
        from core.matching import regenerate_matches_for_user
        from core.models import StudentProfile
        for profile in StudentProfile.objects.select_related('user'):
            try:
                regenerate_matches_for_user(profile.user)
            except Exception:
                continue
    except Exception:
        pass


def unseed(apps, schema_editor):
    Scholarship = apps.get_model('core', 'Scholarship')
    try:
        Scholarship.objects.filter(slug__in=SLUGS).delete()
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_scholarship_application_email_and_more'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
