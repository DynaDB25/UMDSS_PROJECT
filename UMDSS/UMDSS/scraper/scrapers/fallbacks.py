"""Curated fallback scholarship data, one entry per source.

Served (flagged origin='curated', run marked failed) when a live scrape
yields nothing relevant. Hand-maintained: figures here are best-effort and
the matching engine caps curated rows at Partial match.
"""
import datetime


def all_fallbacks() -> dict[str, list[dict]]:
    """Recomputed per call so relative deadlines stay relative."""
    return {
        'african_union': [
        {
        'name': 'African Union Mwalimu Nyerere Scholarship',
        'level_scope': 'postgraduate',
        'provider': 'African Union',
        'provider_type': 'International',
        'amount': 'Full funding',
        'amount_value': 12000,
        'deadline': datetime.date.today() + datetime.timedelta(days=120),
        'region': ['All'],
        'programmes': ['All'],
        'max_aggregate': 12,
        'need_based': False,
        'slots': 100,
        'summary': (
            'The Mwalimu Nyerere African Union Scholarship Scheme supports '
            'students from AU member states to pursue studies at recognized '
            'African universities with full funding.'
        ),
        'benefits': [
            'Full tuition coverage',
            'Monthly living allowance',
            'Travel support',
            'Book and equipment allowance',
        ],
        'documents': [
            'Ghana Card', 'Academic Transcripts',
            'Recommendation Letters', 'Personal Statement',
        ],
        'tags': ['International', 'African Union', 'Pan-African'],
        },
        ],
        'africanscholarships': [
        {
        'name': 'AfricanScholarships.com Ghana Listings',
        'level_scope': 'unknown',
        'provider': 'AfricanScholarships.com',
        'provider_type': 'Foundation',
        'amount': 'Variable',
        'deadline': datetime.date.today() + datetime.timedelta(days=90),
        'region': ['All'],
        'programmes': ['All'],
        'summary': (
            'Aggregated scholarship listings from AfricanScholarships.com '
            'for Ghanaian students across multiple disciplines.'
        ),
        'tags': ['Aggregator', 'Africa', 'Ghana'],
        },
        ],
        'chevening': [
        {
            'name': 'Chevening-Ghana Undergraduate Link',
            'level_scope': 'tertiary_entry',
            'provider': 'UK Government (FCDO)',
            'provider_type': 'International',
            'amount': 'GH₵ 18,000 + exchange term',
            'amount_value': 18000,
            'deadline': datetime.date(2026, 10, 1),
            'region': ['All'],
            'programmes': ['All'],
            'max_aggregate': 8,
            'need_based': False,
            'slots': 25,
            'summary': (
                'Highly selective international award offering funding '
                'plus a one-term exchange at a partner UK university '
                'for exceptional students with leadership potential.'
            ),
            'benefits': [
                'GH₵ 18,000 annual award',
                'One-term UK exchange',
                'Global alumni network',
                'Leadership residential',
            ],
            'documents': [
                'Ghana Card', 'WASSCE Results Slip',
                'Admission Letter', 'Two Recommendation Letters',
                'Leadership Essay',
            ],
            'tags': ['International', 'Highly selective', 'Exchange'],
        },
        ],
        'commonwealth': [
        {
            'name': 'Commonwealth Scholarship for Ghana',
            'level_scope': 'postgraduate',
            'provider': 'Commonwealth Scholarship Commission',
            'provider_type': 'International',
            'amount': 'Full funding (tuition + stipend)',
            'amount_value': 20000,
            'deadline': datetime.date(2026, 12, 1),
            'region': ['All'],
            'programmes': ['All'],
            'max_aggregate': 10,
            'need_based': False,
            'slots': 30,
            'summary': (
                'Commonwealth Scholarships for Ghanaian students to pursue '
                'Master\'s and PhD programmes at UK universities, fully funded '
                'by the UK government.'
            ),
            'benefits': [
                'Full tuition fees',
                'Monthly stipend',
                'Return airfare',
                'Thesis grant',
                'Warm clothing allowance',
            ],
            'documents': [
                'Ghana Card', 'Academic Transcripts',
                'Admission Letter', 'Recommendation Letters',
                'Study Plan',
            ],
            'tags': ['International', 'UK', 'Commonwealth'],
        },
        ],
        'daad': [
        {
            'name': 'DAAD Ghana Scholarship Programme',
            'level_scope': 'postgraduate',
            'provider': 'DAAD (German Academic Exchange Service)',
            'provider_type': 'International',
            'amount': 'EUR 850/month (~GH₵ 15,000/year)',
            'amount_value': 15000,
            'deadline': datetime.date(2026, 10, 15),
            'region': ['All'],
            'programmes': ['All'],
            'max_aggregate': 10,
            'need_based': False,
            'slots': 50,
            'summary': (
                'DAAD scholarships support Ghanaian students to pursue '
                'postgraduate study or research at German universities, '
                'with full funding including monthly stipend and travel.'
            ),
            'benefits': [
                'Monthly stipend of EUR 850',
                'Travel allowance',
                'Health insurance coverage',
                'German language course',
            ],
            'documents': [
                'Ghana Card', 'Academic Transcripts',
                'Admission Letter', 'Recommendation Letters',
                'Research Proposal',
            ],
            'tags': ['International', 'Germany', 'Research'],
        },
        ],
        'getfund': [
        {
        'name': 'GETFund National Scholarship',
        'level_scope': 'tertiary_any',
        'provider': 'Ghana Education Trust Fund',
        'provider_type': 'Government',
        'amount': 'Full tuition + GH₵ 6,000 stipend',
        'amount_value': 14000,
        'deadline': datetime.date(2026, 7, 31),
        'region': ['All'],
        'programmes': ['All'],
        'max_aggregate': 12,
        'need_based': True,
        'slots': 1200,
        'summary': (
            'Government-funded award covering full tuition and an annual '
            'upkeep stipend for academically qualified, financially needy '
            'Ghanaian students in accredited tertiary institutions.'
        ),
        'benefits': [
            'Full tuition for the programme duration',
            'GH₵ 6,000 annual stipend',
            'Book and research allowance',
            'Renewable each academic year',
        ],
        'documents': [
            'Ghana Card', 'WASSCE Results Slip',
            'Admission Letter', 'Financial Need Statement',
        ],
        'tags': ['Need-based', 'Renewable', 'Nationwide'],
        },
        ],
        'knust': [
        {
        'name': 'KNUST Internal Scholarship Scheme',
        'level_scope': 'tertiary_continuing',
        'provider': 'KNUST',
        'provider_type': 'Government',
        'amount': 'GH₵ 3,000 / year',
        'amount_value': 3000,
        'deadline': datetime.date.today() + datetime.timedelta(days=60),
        'region': ['All'],
        'programmes': ['All'],
        'max_aggregate': 15,
        'need_based': True,
        'slots': 500,
        'summary': (
            'Internal scholarship scheme administered by KNUST for '
            'academically strong students with demonstrated financial need.'
        ),
        'benefits': [
            'Partial tuition waiver',
            'GH₵ 3,000 annual stipend',
            'Library access privileges',
        ],
        'documents': [
            'KNUST Student ID', 'Academic Transcripts',
            'Financial Need Statement',
        ],
        'tags': ['University', 'KNUST', 'Need-based'],
        },
        ],
        'mastercard': [
        {
            'name': 'Mastercard Foundation Scholars Program',
            'level_scope': 'tertiary_entry',
            'provider': 'Mastercard Foundation',
            'provider_type': 'Foundation',
            'amount': 'Comprehensive (full cost)',
            'amount_value': 22000,
            'deadline': datetime.date(2026, 8, 20),
            'region': ['All'],
            'programmes': ['All'],
            'max_aggregate': 14,
            'need_based': True,
            'slots': 200,
            'summary': (
                'A comprehensive scholarship covering tuition, accommodation, '
                'meals, books and a monthly stipend, with leadership '
                'development for young Africans committed to giving back.'
            ),
            'benefits': [
                'Full cost of attendance',
                'Accommodation and meals',
                'Monthly personal stipend',
                'Leadership and entrepreneurship training',
            ],
            'documents': [
                'Ghana Card', 'WASSCE Results Slip',
                'Admission Letter', 'Financial Need Statement',
                'Personal Essay',
            ],
            'tags': ['Comprehensive', 'Leadership', 'Need-based'],
        },
        ],
        'mtn': [
        {
        'name': 'MTN Bright Scholarship',
        'level_scope': 'tertiary_entry',
        'provider': 'MTN Ghana Foundation',
        'provider_type': 'Corporate',
        'amount': 'GH₵ 10,000 / year',
        'amount_value': 10000,
        'deadline': datetime.date(2026, 7, 14),
        'region': ['All'],
        'programmes': [
            'BSc Computer Engineering', 'BSc Computer Science',
            'BSc Electrical Engineering', 'BSc Mathematics', 'BSc Physics',
        ],
        'max_aggregate': 10,
        'need_based': True,
        'slots': 150,
        'summary': (
            'Awarded to high-performing students from underserved '
            'backgrounds pursuing STEM programmes, with priority on '
            'ICT and engineering disciplines.'
        ),
        'benefits': [
            'GH₵ 10,000 annual award',
            'Paid internship at MTN Ghana',
            'Mentorship and career coaching',
            'Laptop and data bundle',
        ],
        'documents': [
            'Ghana Card', 'WASSCE Results Slip',
            'Admission Letter', 'Recommendation Letter',
        ],
        'tags': ['STEM', 'Mentorship', 'Internship'],
        },
        ],
        'opportunitydesk': [
        {
        'name': 'OpportunityDesk Scholarship Listings',
        'level_scope': 'unknown',
        'provider': 'OpportunityDesk.org',
        'provider_type': 'Foundation',
        'amount': 'Variable',
        'deadline': datetime.date.today() + datetime.timedelta(days=90),
        'region': ['All'],
        'programmes': ['All'],
        'summary': (
            'Curated scholarship opportunities from OpportunityDesk.org '
            'for African and international students.'
        ),
        'tags': ['Aggregator', 'International'],
        },
        ],
        'secretariat': [
        {
        'name': 'District-Level Scholarship Scheme',
        'level_scope': 'tertiary_any',
        'provider': 'Ghana Scholarships Secretariat',
        'provider_type': 'Government',
        'amount': 'GH₵ 4,500 / year',
        'amount_value': 4500,
        'deadline': datetime.date(2026, 7, 5),
        'region': ['Ashanti', 'Bono', 'Ahafo', 'Bono East'],
        'programmes': ['All'],
        'max_aggregate': 15,
        'need_based': True,
        'slots': 800,
        'summary': (
            'Decentralised award administered through the Metropolitan, '
            'Municipal and District Assemblies (MMDAs) for indigenes of '
            'the district pursuing accredited tertiary programmes.'
        ),
        'benefits': [
            'GH₵ 4,500 annual award',
            'District-level mentorship',
            'Priority for renewal',
            'Community service placement',
        ],
        'documents': [
            'Ghana Card', 'WASSCE Results Slip',
            'Admission Letter', 'Proof of District of Origin',
        ],
        'tags': ['District', 'Interview required', 'Renewable'],
        },
        ],
        'stanbic': [
        {
            'name': 'Stanbic Bank Future Leaders',
            'level_scope': 'tertiary_any',
            'provider': 'Stanbic Bank Ghana',
            'provider_type': 'Corporate',
            'amount': 'GH₵ 8,000 / year',
            'amount_value': 8000,
            'deadline': datetime.date(2026, 9, 10),
            'region': ['All'],
            'programmes': [
                'BA Economics', 'BSc Business Administration',
                'BSc Mathematics', 'BSc Computer Science',
                'BSc Computer Engineering',
            ],
            'max_aggregate': 11,
            'need_based': False,
            'slots': 60,
            'summary': (
                'Merit award for outstanding students in business, finance '
                'and analytics disciplines, with a fast-track route into '
                'the bank\'s graduate programme.'
            ),
            'benefits': [
                'GH₵ 8,000 annual award',
                'Graduate scheme fast-track',
                'Financial literacy bootcamp',
                'Networking with industry leaders',
            ],
            'documents': [
                'Ghana Card', 'WASSCE Results Slip',
                'Admission Letter', 'Statement of Purpose',
            ],
            'tags': ['Merit', 'Business', 'Career track'],
        },
        ],
        'university_of_ghana': [
        {
        'name': 'University of Ghana Scholarship Programme',
        'level_scope': 'tertiary_continuing',
        'provider': 'University of Ghana',
        'provider_type': 'Government',
        'amount': 'GH₵ 3,500 / year',
        'amount_value': 3500,
        'deadline': datetime.date.today() + datetime.timedelta(days=60),
        'region': ['All'],
        'programmes': ['All'],
        'max_aggregate': 14,
        'need_based': True,
        'slots': 400,
        'summary': (
            'University of Ghana internal scholarship programme for '
            'meritorious and financially disadvantaged students across '
            'all faculties.'
        ),
        'benefits': [
            'Partial tuition coverage',
            'GH₵ 3,500 annual stipend',
            'Academic mentorship',
        ],
        'documents': [
            'UG Student ID', 'Academic Transcripts',
            'Financial Need Statement',
        ],
        'tags': ['University', 'UG', 'Need-based'],
        },
        ],
        'world_bank': [
        {
        'name': 'Joint Japan/World Bank Graduate Scholarship (JJ/WBGSP)',
        'level_scope': 'postgraduate',
        'provider': 'World Bank Group',
        'provider_type': 'International',
        'amount': 'Full funding (tuition + stipend)',
        'amount_value': 25000,
        'deadline': datetime.date.today() + datetime.timedelta(days=150),
        'region': ['All'],
        'programmes': ['All'],
        'max_aggregate': 10,
        'need_based': False,
        'slots': 40,
        'summary': (
            'The JJ/WBGSP provides full scholarships for mid-career '
            'professionals from developing countries to pursue graduate '
            'studies related to development at partner universities.'
        ),
        'benefits': [
            'Full tuition and fees',
            'Monthly living stipend',
            'Round-trip airfare',
            'Health insurance',
            'Book and equipment allowance',
        ],
        'documents': [
            'Ghana Card', 'Academic Transcripts',
            'Recommendation Letters', 'Statement of Purpose',
            'Proof of Employment',
        ],
        'tags': ['International', 'World Bank', 'Development'],
        },
        ],
    }
