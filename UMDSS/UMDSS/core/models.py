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
    # Registration states that deadline reminders arrive by SMS, so this starts
    # on. Turning it off stops every text; the in-app notification is still
    # written, so nobody loses the alert itself by opting out of the channel.
    sms_opt_in = models.BooleanField(default=True)
    email_opt_in = models.BooleanField(default=True)

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


class ScholarshipQuerySet(models.QuerySet):
    def verifiable(self):
        """Rows a student is allowed to see: scraped from a live page we can
        link back to.

        This is the authenticity gate. It excludes demo fixtures
        (origin='seeded') and unverified curated fallbacks (origin='curated'),
        and any row missing the source_url a student would use to confirm it at
        the provider. Everything the app surfaces — the catalogue and the
        matches — is filtered through here, so nothing invented or unsourced can
        reach a student even if such a row exists in the table.
        """
        return self.filter(origin='scraped').exclude(source_url='')


class Scholarship(models.Model):
    # Custom manager keeps `Scholarship.objects.all()` working everywhere while
    # adding `.verifiable()` for the app-facing surfaces.
    objects = ScholarshipQuerySet.as_manager()

    PROVIDER_TYPES = [
        ('Government', 'Government'),
        ('Corporate', 'Corporate'),
        ('International', 'International'),
        ('Foundation', 'Foundation'),
    ]

    ORIGINS = [
        ('scraped', 'Scraped from live site'),
        ('seeded', 'Seeded demo data'),
        ('curated', 'Curated fallback, not confirmed against the live site'),
    ]

    LEVEL_SCOPES = [
        ('shs', 'SHS students (funding to complete SHS)'),
        ('tertiary_entry', 'Entering tertiary (SHS graduates / level 100)'),
        ('tertiary_continuing', 'Continuing tertiary students'),
        ('tertiary_any', 'Any undergraduate'),
        ('postgraduate', 'Postgraduate'),
        ('unknown', 'Not classified'),
    ]

    GENDER_SCOPES = [
        ('any', 'Open to all genders'),
        ('female', 'Women only'),
        ('male', 'Men only'),
    ]

    APPLICATION_MODES = [
        ('online', 'Apply online on the provider\'s portal'),
        ('email', 'Apply by email'),
        ('offline', 'Apply in person / by post'),
        ('unknown', 'Not stated'),
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
    # Some awards are restricted by gender (a lot of STEM and leadership funds
    # in Ghana are women-only). 'any' means no restriction.
    gender_scope = models.CharField(
        max_length=10, choices=GENDER_SCOPES, default='any',
        help_text="Restrict this award to one gender. Women-only funds use 'female'.",
    )
    need_based = models.BooleanField(default=False)

    # How a student actually applies to the funder. ScholarCircle tracks the
    # application, but the real submission happens on the provider's side.
    application_url = models.URLField(
        max_length=500, blank=True, default='',
        help_text='Direct link to the provider application form or portal.',
    )
    application_email = models.EmailField(
        blank=True, default='',
        help_text='Where to send the application when the mode is email.',
    )
    application_mode = models.CharField(
        max_length=10, choices=APPLICATION_MODES, default='unknown',
    )
    # When we last crawled the provider's page looking for the form. Lets a
    # fruitless search back off instead of re-crawling on every page view.
    application_checked_at = models.DateTimeField(null=True, blank=True)
    # Ranked places the crawler thinks the application might live, kept even
    # when none scored high enough to auto-select. Without this a student on the
    # cached path would see nothing at all for a week.
    application_candidates = models.JSONField(
        default=list, blank=True,
        help_text='Ranked application candidates: [{url, score, reason, kind, host, embeddable}].',
    )
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
    submitted_on = models.CharField(max_length=20, default='-')
    last_update = models.DateField(auto_now=True)
    progress = models.IntegerField(default=0)
    timeline = models.JSONField(default=list, help_text='List of {label, date, done} objects')
    # Snapshot of vault documents auto-attached at apply time, plus any required
    # documents the student was still missing. List of {requirement, name?,
    # doc_type?, label?, have} objects.
    attached_documents = models.JSONField(default=list)

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
    # Which document this is (ghana_card, transcript, admission_letter, …). Drives
    # the vault checklist and the auto-attach when applying. See core/documents.py.
    doc_type = models.CharField(max_length=40, blank=True, default='')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    size = models.CharField(max_length=20, blank=True)
    uploaded_on = models.CharField(max_length=20, default='-')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    linked_applications = models.IntegerField(default=0)
    encrypted = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class SuggestedApplicationLink(models.Model):
    """Where a student says they actually found the application form.

    The crawler cannot reach everything, but a student who gets to a funder's
    site has the real link in front of them. One tap saves it for everyone
    behind them. No admin sits in the middle: a link is promoted to the
    scholarship once two different students independently report the same one,
    so a single bad paste can never misdirect anybody.
    """
    CONFIRMATIONS_NEEDED = 2

    scholarship = models.ForeignKey(
        Scholarship, on_delete=models.CASCADE, related_name='suggested_links')
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='suggested_links')
    url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One vote per student per scholarship, so nobody can confirm their own
        # suggestion by submitting it twice.
        unique_together = ('scholarship', 'student')

    def __str__(self):
        return f"{self.student} → {self.scholarship.name}: {self.url}"


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


class OutboundMessage(models.Model):
    """One attempted delivery on a real channel, kept whether or not it left.

    SMS credits are money and both gateways are somebody else's uptime, so
    every attempt is recorded: what went out, where, and what came back.
    Failures are rows too — a number or address the provider rejected is the
    single most useful thing to see when a student says the reminder never
    arrived.
    """
    CHANNEL_CHOICES = [('SMS', 'SMS'), ('Email', 'Email')]
    STATUS_CHOICES = [
        # Queued is written before the provider is called, so the unique index
        # below claims the event first. A row still Queued long afterwards means
        # the process died mid-send and we genuinely do not know what happened.
        ('Queued', 'Queued'),
        ('Sent', 'Sent'),
        ('Failed', 'Failed'),
        ('Skipped', 'Skipped'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outbound_messages')
    notification = models.ForeignKey(
        Notification, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='outbound_messages',
        help_text='The in-app alert this delivery accompanied, if any.')
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    recipient = models.CharField(
        max_length=254, blank=True,
        help_text='E.164 number or email address. Blank when the profile held '
                  'nothing usable.')
    # SMS has no subject; the column stays empty on those rows.
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    provider = models.CharField(max_length=20, default='console')
    provider_message_id = models.CharField(max_length=120, blank=True)
    # Why a Skipped row was skipped, or what the provider said about a failure.
    error = models.CharField(max_length=300, blank=True)
    # Identifies the event this delivery was for, e.g. 'deadline:draft:3:41:7'
    # for the seven-day warning to student 3 about scholarship 41. Lets a re-run
    # recognise work it has already done. Blank for sends with no natural key.
    dedupe_key = models.CharField(max_length=120, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # A partial unique index, so the database itself refuses a second
            # delivery for the same event on the same channel. The daily job
            # re-runs on every push and can be triggered by hand; neither should
            # message anyone twice. Scoped by channel so that one event can
            # still reach a student by both SMS and email.
            models.UniqueConstraint(
                fields=['channel', 'dedupe_key'],
                condition=~models.Q(dedupe_key=''),
                name='unique_outbound_channel_dedupe_key',
            ),
        ]

    def __str__(self):
        return f'{self.channel} to {self.recipient or "(none)"} [{self.status}]'
