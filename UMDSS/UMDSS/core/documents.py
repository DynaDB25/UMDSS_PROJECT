"""Canonical document types for the vault.

Single source of truth: this drives the upload picker, the "which documents do
I have" checklist, the scholarship requirement matching, and the auto-attach at
apply time. It is exposed to the frontend via /api/reference/ so the client and
the server recognise the same documents the same way.

Each type has:
  key       stable identifier stored on VaultDocument.doc_type
  label     human name shown in the UI
  category  one of VaultDocument's categories
  keywords  lowercase substrings we use to recognise a scholarship's free-text
            requirement (e.g. "admission letter") as this type
"""

DOCUMENT_TYPES = [
    {'key': 'ghana_card', 'label': 'Ghana Card (National ID)', 'category': 'Identity',
     'keywords': ['ghana card', 'national id', 'national identification', 'nia', 'national identity']},
    {'key': 'passport_photo', 'label': 'Passport Photo', 'category': 'Identity',
     'keywords': ['passport photo', 'passport picture', 'passport-size', 'passport size', 'photograph']},
    {'key': 'birth_certificate', 'label': 'Birth Certificate', 'category': 'Identity',
     'keywords': ['birth certificate']},
    {'key': 'proof_of_residence', 'label': 'Proof of District / Residence', 'category': 'Identity',
     'keywords': ['proof of district', 'district origin', 'district of origin', 'proof of residence',
                  'residence', 'hometown', 'place of origin']},
    {'key': 'wassce', 'label': 'WASSCE Results Slip', 'category': 'Academic',
     'keywords': ['wassce', 'result slip', 'results slip', 'exam results', 'waec', 'ssce', 'bece']},
    {'key': 'transcript', 'label': 'Academic Transcript', 'category': 'Academic',
     'keywords': ['transcript', 'academic record', 'statement of results', 'academic results']},
    {'key': 'admission_letter', 'label': 'Admission Letter', 'category': 'Admission',
     'keywords': ['admission letter', 'letter of admission', 'admission', 'offer letter',
                  'enrolment', 'enrollment']},
    {'key': 'student_id', 'label': 'Student ID Card', 'category': 'Admission',
     'keywords': ['student id', 'student identification', 'school id']},
    {'key': 'recommendation', 'label': 'Recommendation / Reference Letter', 'category': 'Academic',
     'keywords': ['recommendation', 'reference letter', 'referee', 'letter of reference']},
    {'key': 'personal_statement', 'label': 'Personal Statement / Essay', 'category': 'Other',
     'keywords': ['personal statement', 'essay', 'motivation letter', 'statement of purpose',
                  'cover letter']},
    {'key': 'cv', 'label': 'CV / Résumé', 'category': 'Other',
     'keywords': ['curriculum vitae', 'resume', 'résumé', ' cv', 'cv ']},
    {'key': 'proof_of_income', 'label': 'Proof of Income / Financial Need', 'category': 'Financial',
     'keywords': ['proof of income', 'income', 'financial statement', 'financial need',
                  'payslip', 'pay slip', 'bank statement', 'means test']},
    {'key': 'other', 'label': 'Other Document', 'category': 'Other', 'keywords': []},
]

_BY_KEY = {d['key']: d for d in DOCUMENT_TYPES}


def label_for(key):
    d = _BY_KEY.get(key)
    return d['label'] if d else 'Document'


def category_for(key):
    d = _BY_KEY.get(key)
    return d['category'] if d else 'Other'


def is_valid_type(key):
    return key in _BY_KEY


def match_requirement(text):
    """Map a scholarship's free-text required-document string to a doc_type key,
    or None if we can't confidently recognise it."""
    t = f' {(text or "").lower()} '
    for d in DOCUMENT_TYPES:
        for kw in d['keywords']:
            if kw and kw in t:
                return d['key']
    return None
