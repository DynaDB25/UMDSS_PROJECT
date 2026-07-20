from django.db import models
from django.contrib.auth.models import User


class StudentProfile(models.Model):
    NEED_CHOICES = [('Low', 'Low'), ('Moderate', 'Moderate'), ('High', 'High')]
    GENDER_CHOICES = [('Male', 'Male'), ('Female', 'Female'), ('Prefer not to say', 'Prefer not to say')]
    STUDENT_TYPES = [('SHS', 'SHS student'), ('University', 'University student')]
    SHS_LEVELS = [('Form 1', 'Form 1'), ('Form 2', 'Form 2'), ('Form 3', 'Form 3'), ('Completed', 'Completed SHS')]
    WASSCE_STATUSES = [
        ('not_written', 'Not yet written'),
        ('awaiting', 'Awaiting results'),
        ('released', 'Results released'),
    ]
    UNIVERSITY_LEVELS = [
        ('100', 'Level 100'), ('200', 'Level 200'), ('300', 'Level 300'),
        ('400', 'Level 400'), ('Postgraduate', 'Postgraduate'),
    ]
    STANDINGS = [
        ('First Class', 'First Class'),
        ('Second Class Upper', 'Second Class Upper'),
        ('Second Class Lower', 'Second Class Lower'),
        ('Third Class', 'Third Class'),
        ('Pass', 'Pass'),
        ('No results yet', 'No results yet'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True)

    # Blank until onboarding completes; matching treats a blank type as an
    # incomplete profile and will not claim confident eligibility.
    student_type = models.CharField(max_length=12, choices=STUDENT_TYPES, blank=True)

    # SHS track
    shs_school = models.CharField(max_length=200, blank=True)
    shs_level = models.CharField(max_length=12, choices=SHS_LEVELS, blank=True)
    wassce_status = models.CharField(max_length=12, choices=WASSCE_STATUSES, blank=True)

    # University track
    student_id = models.CharField(max_length=30, blank=True)
    programme = models.CharField(max_length=120, blank=True)
    institution = models.CharField(max_length=200, blank=True)
    level = models.CharField(max_length=50, blank=True)
    university_level = models.CharField(max_length=14, choices=UNIVERSITY_LEVELS, blank=True)
    academic_standing = models.CharField(max_length=20, choices=STANDINGS, blank=True)

    region = models.CharField(max_length=50, blank=True)
    home_district = models.CharField(max_length=100, blank=True)
    # Null means "not provided" (e.g. an SHS student awaiting results). The old
    # default of 36 conflated "unknown" with "worst possible", which let the
    # matcher score profiles that had never entered a result.
    wassce_aggregate = models.IntegerField(null=True, blank=True)
    gender = models.CharField(max_length=30, choices=GENDER_CHOICES, blank=True)
    need_level = models.CharField(max_length=20, choices=NEED_CHOICES, default='Low')
    avatar_color = models.CharField(max_length=60, default='from-brand-500 to-brand-700')
    profile_completion = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.student_id})"


class Scholarship(models.Model):
    PROVIDER_TYPES = [
        ('Government', 'Government'),
        ('Corporate', 'Corporate'),
        ('International', 'International'),
        ('Foundation', 'Foundation'),
    ]

    ORIGINS = [
        ('scraped', 'Scraped from live site'),
        ('seeded', 'Seeded demo data'),
        ('curated', 'Curated fallback — not confirmed against the live site'),
    ]

    LEVEL_SCOPES = [
        ('shs', 'SHS students (funding to complete SHS)'),
        ('tertiary_entry', 'Entering tertiary (SHS graduates / level 100)'),
        ('tertiary_continuing', 'Continuing tertiary students'),
        ('tertiary_any', 'Any undergraduate'),
        ('postgraduate', 'Postgraduate'),
        ('unknown', 'Not classified'),
    ]

    slug = models.SlugField(unique=True)
    source_url = models.URLField(
        max_length=500, blank=True, default='',
        help_text="The live page this scholarship was scraped from, so students "
                  "can verify and apply at the original listing.",
    )
    origin = models.CharField(
        max_length=10,
        choices=ORIGINS,
        default='scraped',
        help_text="Where this row came from. 'curated' means the live scrape failed "
                  "and hardcoded data was substituted, so its figures are unverified.",
    )
    level_scope = models.CharField(
        max_length=20,
        choices=LEVEL_SCOPES,
        default='unknown',
        help_text="Which students this award is for. 'unknown' caps matches at "
                  "Partial because eligibility cannot be confirmed.",
    )
    name = models.CharField(max_length=200)
    provider = models.CharField(max_length=200)
    provider_type = models.CharField(max_length=20, choices=PROVIDER_TYPES)
    logo_color = models.CharField(max_length=30, default='bg-emerald-600')
    initials = models.CharField(max_length=4)
    amount = models.CharField(max_length=100)
    amount_value = models.IntegerField(default=0)
    # Null = the provider's page doesn't state one. The old behaviour of
    # substituting "today + 90 days" made stale listings look current forever.
    deadline = models.DateField(null=True, blank=True)
    region = models.JSONField(default=list, help_text='List of eligible regions or ["All"]')
    programmes = models.JSONField(default=list, help_text='List of eligible programmes or ["All"]')
    max_aggregate = models.IntegerField(default=36)
    need_based = models.BooleanField(default=False)
    slots = models.IntegerField(default=0)
    applicants = models.IntegerField(default=0)
    summary = models.TextField(blank=True)
    benefits = models.JSONField(default=list)
    documents = models.JSONField(default=list)
    tags = models.JSONField(default=list)

    def __str__(self):
        return self.name


class MatchResult(models.Model):
    STATUS_CHOICES = [
        ('Strong match', 'Strong match'),
        ('Partial match', 'Partial match'),
        ('Not eligible', 'Not eligible'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches')
    scholarship = models.ForeignKey(Scholarship, on_delete=models.CASCADE, related_name='matches')
    score = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    criteria = models.JSONField(default=list, help_text='List of {label, met, detail} objects')

    class Meta:
        unique_together = ('student', 'scholarship')

    def __str__(self):
        return f"{self.student.get_full_name()} ↔ {self.scholarship.name}: {self.score}%"


class Application(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Under Review', 'Under Review'),
        ('Interview', 'Interview'),
        ('Awarded', 'Awarded'),
        ('Rejected', 'Rejected'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='applications')
    scholarship = models.ForeignKey(Scholarship, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    submitted_on = models.CharField(max_length=20, default='—')
    last_update = models.DateField(auto_now=True)
    progress = models.IntegerField(default=0)
    timeline = models.JSONField(default=list, help_text='List of {label, date, done} objects')

    def __str__(self):
        return f"{self.student.get_full_name()} → {self.scholarship.name} [{self.status}]"


class VaultDocument(models.Model):
    CATEGORY_CHOICES = [
        ('Identity', 'Identity'),
        ('Academic', 'Academic'),
        ('Admission', 'Admission'),
        ('Financial', 'Financial'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Verified', 'Verified'),
        ('Pending', 'Pending'),
        ('Action needed', 'Action needed'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vault_documents')
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='vault_documents/', null=True, blank=True)
    file_type = models.CharField(max_length=10, default='PDF')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    size = models.CharField(max_length=20, blank=True)
    uploaded_on = models.CharField(max_length=20, default='—')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    linked_applications = models.IntegerField(default=0)
    encrypted = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Notification(models.Model):
    CHANNEL_CHOICES = [('SMS', 'SMS'), ('Email', 'Email'), ('System', 'System')]
    CATEGORY_CHOICES = [
        ('Deadline', 'Deadline'),
        ('Status', 'Status'),
        ('Interview', 'Interview'),
        ('Match', 'Match'),
        ('System', 'System'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=200)
    body = models.TextField()
    time = models.CharField(max_length=30)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
