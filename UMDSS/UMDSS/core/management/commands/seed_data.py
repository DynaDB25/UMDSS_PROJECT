"""
Management command to seed the database with the same demo data
that the React mock.ts file uses.

Usage:  python manage.py seed_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import (
    StudentProfile, Scholarship, MatchResult,
    Application, VaultDocument, Notification,
)


class Command(BaseCommand):
    help = 'Seed DB with demo data matching the React frontend mock data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database…')

        # ── Demo user ─────────────────────────────────
        user, created = User.objects.get_or_create(
            username='benjamin.darko@st.knust.edu.gh',
            defaults={
                'email': 'benjamin.darko@st.knust.edu.gh',
                'first_name': 'Benjamin',
                'last_name': 'Darko',
            },
        )
        if created:
            user.set_password('demopassword')
            user.save()

        profile, _ = StudentProfile.objects.get_or_create(
            user=user,
            defaults={
                'phone': '+233 24 712 0098',
                'student_id': '1821122',
                'programme': 'BSc Computer Engineering',
                'institution': 'Kwame Nkrumah University of Science & Technology',
                'level': '100 · First Year',
                'region': 'Ashanti',
                'home_district': 'Kumasi Metropolitan',
                'wassce_aggregate': 8,
                'gender': 'Male',
                'need_level': 'High',
                'profile_completion': 92,
            },
        )

        # ── Scholarships ──────────────────────────────
        scholarships_data = [
            {
                'slug': 'sch-getfund',
                'name': 'GETFund National Scholarship',
                'provider': 'Ghana Education Trust Fund',
                'provider_type': 'Government',
                'logo_color': 'bg-emerald-600',
                'initials': 'GF',
                'amount': 'Full tuition + GH₵ 6,000 stipend',
                'amount_value': 14000,
                'deadline': '2026-07-31',
                'region': ['All'],
                'programmes': ['All'],
                'max_aggregate': 12,
                'need_based': True,
                'slots': 1200,
                'applicants': 8420,
                'summary': 'Government-funded award covering full tuition and an annual upkeep stipend for academically qualified, financially needy Ghanaian students in accredited tertiary institutions.',
                'benefits': ['Full tuition for the programme duration', 'GH₵ 6,000 annual stipend', 'Book and research allowance', 'Renewable each academic year'],
                'documents': ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Financial Need Statement'],
                'tags': ['Need-based', 'Renewable', 'Nationwide'],
            },
            {
                'slug': 'sch-mtn',
                'name': 'MTN Bright Scholarship',
                'provider': 'MTN Ghana Foundation',
                'provider_type': 'Corporate',
                'logo_color': 'bg-amber-500',
                'initials': 'MB',
                'amount': 'GH₵ 10,000 / year',
                'amount_value': 10000,
                'deadline': '2026-07-14',
                'region': ['All'],
                'programmes': ['BSc Computer Engineering', 'BSc Computer Science', 'BSc Electrical Engineering', 'BSc Mathematics', 'BSc Physics'],
                'max_aggregate': 10,
                'need_based': True,
                'slots': 150,
                'applicants': 3110,
                'summary': 'Awarded to high-performing students from underserved backgrounds pursuing STEM programmes, with priority on ICT and engineering disciplines.',
                'benefits': ['GH₵ 10,000 annual award', 'Paid internship at MTN Ghana', 'Mentorship and career coaching', 'Laptop and data bundle'],
                'documents': ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Recommendation Letter'],
                'tags': ['STEM', 'Mentorship', 'Internship'],
            },
            {
                'slug': 'sch-mastercard',
                'name': 'Mastercard Foundation Scholars',
                'provider': 'Mastercard Foundation',
                'provider_type': 'Foundation',
                'logo_color': 'bg-orange-600',
                'initials': 'MC',
                'amount': 'Comprehensive (full cost)',
                'amount_value': 22000,
                'deadline': '2026-08-20',
                'region': ['All'],
                'programmes': ['All'],
                'max_aggregate': 14,
                'need_based': True,
                'slots': 200,
                'applicants': 5240,
                'summary': 'A comprehensive scholarship covering tuition, accommodation, meals, books and a monthly stipend, with leadership development for young Africans committed to giving back.',
                'benefits': ['Full cost of attendance', 'Accommodation and meals', 'Monthly personal stipend', 'Leadership and entrepreneurship training'],
                'documents': ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Financial Need Statement', 'Personal Essay'],
                'tags': ['Comprehensive', 'Leadership', 'Need-based'],
            },
            {
                'slug': 'sch-district',
                'name': 'District-Level Scholarship Scheme',
                'provider': 'Ghana Scholarships Secretariat',
                'provider_type': 'Government',
                'logo_color': 'bg-teal-700',
                'initials': 'DS',
                'amount': 'GH₵ 4,500 / year',
                'amount_value': 4500,
                'deadline': '2026-07-05',
                'region': ['Ashanti', 'Bono', 'Ahafo', 'Bono East'],
                'programmes': ['All'],
                'max_aggregate': 15,
                'need_based': True,
                'slots': 800,
                'applicants': 6190,
                'summary': 'Decentralised award administered through the Metropolitan, Municipal and District Assemblies (MMDAs) for indigenes of the district pursuing accredited tertiary programmes.',
                'benefits': ['GH₵ 4,500 annual award', 'District-level mentorship', 'Priority for renewal', 'Community service placement'],
                'documents': ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Proof of District of Origin'],
                'tags': ['District', 'Interview required', 'Renewable'],
            },
            {
                'slug': 'sch-stanbic',
                'name': 'Stanbic Bank Future Leaders',
                'provider': 'Stanbic Bank Ghana',
                'provider_type': 'Corporate',
                'logo_color': 'bg-blue-700',
                'initials': 'SB',
                'amount': 'GH₵ 8,000 / year',
                'amount_value': 8000,
                'deadline': '2026-09-10',
                'region': ['All'],
                'programmes': ['BA Economics', 'BSc Business Administration', 'BSc Mathematics', 'BSc Computer Science', 'BSc Computer Engineering'],
                'max_aggregate': 11,
                'need_based': False,
                'slots': 60,
                'applicants': 1880,
                'summary': 'Merit award for outstanding students in business, finance and analytics disciplines, with a fast-track route into the bank graduate programme.',
                'benefits': ['GH₵ 8,000 annual award', 'Graduate scheme fast-track', 'Financial literacy bootcamp', 'Networking with industry leaders'],
                'documents': ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Statement of Purpose'],
                'tags': ['Merit', 'Business', 'Career track'],
            },
            {
                'slug': 'sch-chevening',
                'name': 'Chevening-Ghana Undergraduate Link',
                'provider': 'UK Government (FCDO)',
                'provider_type': 'International',
                'logo_color': 'bg-indigo-700',
                'initials': 'CV',
                'amount': 'GH₵ 18,000 + exchange term',
                'amount_value': 18000,
                'deadline': '2026-10-01',
                'region': ['All'],
                'programmes': ['All'],
                'max_aggregate': 8,
                'need_based': False,
                'slots': 25,
                'applicants': 2400,
                'summary': 'Highly selective international award offering funding plus a one-term exchange at a partner UK university for exceptional students with leadership potential.',
                'benefits': ['GH₵ 18,000 annual award', 'One-term UK exchange', 'Global alumni network', 'Leadership residential'],
                'documents': ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Two Recommendation Letters', 'Leadership Essay'],
                'tags': ['International', 'Highly selective', 'Exchange'],
            },
        ]

        sch_map = {}  # slug → Scholarship instance
        for s in scholarships_data:
            obj, _ = Scholarship.objects.update_or_create(
                slug=s['slug'], defaults={**s, 'origin': 'seeded'},
            )
            sch_map[s['slug']] = obj

        # ── Matches ───────────────────────────────────
        matches_data = [
            {
                'scholarship_slug': 'sch-mtn',
                'score': 96,
                'status': 'Strong match',
                'criteria': [
                    {'label': 'WASSCE aggregate', 'met': True, 'detail': 'Your aggregate 8 is within the required ≤ 10'},
                    {'label': 'Programme of study', 'met': True, 'detail': 'Computer Engineering is a priority STEM field'},
                    {'label': 'Region', 'met': True, 'detail': 'Open to all 16 regions'},
                    {'label': 'Financial need', 'met': True, 'detail': 'High need level matches the award focus'},
                ],
            },
            {
                'scholarship_slug': 'sch-getfund',
                'score': 92,
                'status': 'Strong match',
                'criteria': [
                    {'label': 'WASSCE aggregate', 'met': True, 'detail': 'Your aggregate 8 is within the required ≤ 12'},
                    {'label': 'Programme of study', 'met': True, 'detail': 'Open to all accredited programmes'},
                    {'label': 'Region', 'met': True, 'detail': 'Nationwide eligibility'},
                    {'label': 'Financial need', 'met': True, 'detail': 'High need level qualifies'},
                ],
            },
            {
                'scholarship_slug': 'sch-chevening',
                'score': 88,
                'status': 'Strong match',
                'criteria': [
                    {'label': 'WASSCE aggregate', 'met': True, 'detail': 'Your aggregate 8 meets the strict ≤ 8 cut-off'},
                    {'label': 'Programme of study', 'met': True, 'detail': 'Open to all programmes'},
                    {'label': 'Region', 'met': True, 'detail': 'Nationwide eligibility'},
                    {'label': 'Leadership evidence', 'met': False, 'detail': 'Add a leadership essay to strengthen this'},
                ],
            },
            {
                'scholarship_slug': 'sch-district',
                'score': 78,
                'status': 'Partial match',
                'criteria': [
                    {'label': 'WASSCE aggregate', 'met': True, 'detail': 'Your aggregate 8 is within ≤ 15'},
                    {'label': 'Region', 'met': True, 'detail': 'Ashanti is an eligible district zone'},
                    {'label': 'Programme of study', 'met': True, 'detail': 'Open to all programmes'},
                    {'label': 'Proof of district origin', 'met': False, 'detail': 'Upload proof of Kumasi Metro origin to qualify'},
                ],
            },
            {
                'scholarship_slug': 'sch-stanbic',
                'score': 71,
                'status': 'Partial match',
                'criteria': [
                    {'label': 'WASSCE aggregate', 'met': True, 'detail': 'Your aggregate 8 is within ≤ 11'},
                    {'label': 'Region', 'met': True, 'detail': 'Nationwide eligibility'},
                    {'label': 'Programme of study', 'met': False, 'detail': 'Computer Engineering is borderline; CS / Business preferred'},
                    {'label': 'Merit threshold', 'met': True, 'detail': 'Strong academic standing'},
                ],
            },
            {
                'scholarship_slug': 'sch-mastercard',
                'score': 90,
                'status': 'Strong match',
                'criteria': [
                    {'label': 'WASSCE aggregate', 'met': True, 'detail': 'Your aggregate 8 is within ≤ 14'},
                    {'label': 'Programme of study', 'met': True, 'detail': 'Open to all programmes'},
                    {'label': 'Region', 'met': True, 'detail': 'Nationwide eligibility'},
                    {'label': 'Financial need', 'met': True, 'detail': 'High need is the primary criterion'},
                ],
            },
        ]

        for m in matches_data:
            MatchResult.objects.update_or_create(
                student=user,
                scholarship=sch_map[m['scholarship_slug']],
                defaults={
                    'score': m['score'],
                    'status': m['status'],
                    'criteria': m['criteria'],
                },
            )

        # ── Applications ──────────────────────────────
        apps_data = [
            {
                'scholarship_slug': 'sch-mtn',
                'status': 'Interview',
                'submitted_on': '2026-06-12',
                'progress': 75,
                'timeline': [
                    {'label': 'Application submitted', 'date': '12 Jun 2026', 'done': True},
                    {'label': 'Documents verified', 'date': '18 Jun 2026', 'done': True},
                    {'label': 'Shortlisted for interview', 'date': '26 Jun 2026', 'done': True},
                    {'label': 'Interview scheduled', 'date': '03 Jul 2026', 'done': False},
                    {'label': 'Final decision', 'date': 'Expected 15 Jul', 'done': False},
                ],
            },
            {
                'scholarship_slug': 'sch-getfund',
                'status': 'Under Review',
                'submitted_on': '2026-06-20',
                'progress': 50,
                'timeline': [
                    {'label': 'Application submitted', 'date': '20 Jun 2026', 'done': True},
                    {'label': 'Documents verified', 'date': '24 Jun 2026', 'done': True},
                    {'label': 'Eligibility review', 'date': 'In progress', 'done': False},
                    {'label': 'Award decision', 'date': 'Expected 31 Jul', 'done': False},
                ],
            },
            {
                'scholarship_slug': 'sch-district',
                'status': 'Submitted',
                'submitted_on': '2026-06-28',
                'progress': 25,
                'timeline': [
                    {'label': 'Application submitted', 'date': '28 Jun 2026', 'done': True},
                    {'label': 'Documents verification', 'date': 'Pending', 'done': False},
                    {'label': 'District interview', 'date': 'To be scheduled', 'done': False},
                    {'label': 'Award decision', 'date': 'Expected 20 Jul', 'done': False},
                ],
            },
            {
                'scholarship_slug': 'sch-mastercard',
                'status': 'Draft',
                'submitted_on': '—',
                'progress': 10,
                'timeline': [
                    {'label': 'Draft started', 'date': '27 Jun 2026', 'done': True},
                    {'label': 'Personal essay', 'date': 'Incomplete', 'done': False},
                    {'label': 'Submit application', 'date': 'Due 20 Aug', 'done': False},
                ],
            },
        ]

        for a in apps_data:
            Application.objects.update_or_create(
                student=user,
                scholarship=sch_map[a['scholarship_slug']],
                defaults={
                    'status': a['status'],
                    'submitted_on': a['submitted_on'],
                    'progress': a['progress'],
                    'timeline': a['timeline'],
                },
            )

        # ── Vault Documents ───────────────────────────
        docs_data = [
            {'name': 'Ghana Card (Front & Back)', 'file_type': 'PDF', 'category': 'Identity', 'size': '1.2 MB', 'uploaded_on': '02 Jun 2026', 'status': 'Verified', 'linked_applications': 4, 'encrypted': True},
            {'name': 'WASSCE Results Slip', 'file_type': 'PDF', 'category': 'Academic', 'size': '840 KB', 'uploaded_on': '02 Jun 2026', 'status': 'Verified', 'linked_applications': 4, 'encrypted': True},
            {'name': 'KNUST Admission Letter', 'file_type': 'PDF', 'category': 'Admission', 'size': '510 KB', 'uploaded_on': '05 Jun 2026', 'status': 'Verified', 'linked_applications': 3, 'encrypted': True},
            {'name': 'Financial Need Statement', 'file_type': 'PDF', 'category': 'Financial', 'size': '320 KB', 'uploaded_on': '11 Jun 2026', 'status': 'Pending', 'linked_applications': 2, 'encrypted': True},
            {'name': 'Recommendation Letter — Mr. Owusu', 'file_type': 'PDF', 'category': 'Other', 'size': '290 KB', 'uploaded_on': '14 Jun 2026', 'status': 'Verified', 'linked_applications': 1, 'encrypted': True},
            {'name': 'Proof of District of Origin', 'file_type': 'JPG', 'category': 'Identity', 'size': '1.8 MB', 'uploaded_on': '—', 'status': 'Action needed', 'linked_applications': 0, 'encrypted': True},
        ]

        for d in docs_data:
            VaultDocument.objects.update_or_create(
                student=user,
                name=d['name'],
                defaults=d,
            )

        # ── Notifications ─────────────────────────────
        notifs_data = [
            {'channel': 'SMS', 'category': 'Interview', 'title': 'Interview scheduled', 'body': 'MTN Bright Scholarship interview set for Thu 03 Jul, 10:00 AM at MTN House, Accra. Reply 1 to confirm.', 'time': '2 hours ago', 'read': False},
            {'channel': 'SMS', 'category': 'Deadline', 'title': 'Deadline in 6 days', 'body': 'District-Level Scholarship closes 05 Jul 2026. Your application is submitted; upload Proof of Origin to complete.', 'time': '5 hours ago', 'read': False},
            {'channel': 'Email', 'category': 'Status', 'title': 'Documents verified', 'body': 'Your GETFund National Scholarship documents have passed verification. Eligibility review is now in progress.', 'time': 'Yesterday', 'read': False},
            {'channel': 'System', 'category': 'Match', 'title': '3 new strong matches', 'body': 'We found 3 new scholarships matching your profile after the June criteria update.', 'time': 'Yesterday', 'read': True},
            {'channel': 'Email', 'category': 'Deadline', 'title': 'MTN deadline reminder', 'body': 'MTN Bright Scholarship closes 14 Jul 2026. You have an active application in progress.', 'time': '2 days ago', 'read': True},
            {'channel': 'System', 'category': 'System', 'title': 'Profile 92% complete', 'body': 'Add a leadership essay to unlock eligibility for the Chevening-Ghana Undergraduate Link.', 'time': '3 days ago', 'read': True},
        ]

        for n in notifs_data:
            Notification.objects.update_or_create(
                student=user,
                title=n['title'],
                defaults=n,
            )

        self.stdout.write(self.style.SUCCESS(
            f'✓ Seeded: 1 user, {len(scholarships_data)} scholarships, '
            f'{len(matches_data)} matches, {len(apps_data)} applications, '
            f'{len(docs_data)} documents, {len(notifs_data)} notifications'
        ))
