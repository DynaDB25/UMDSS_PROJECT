"""
Django settings for UMDSS project.
"""

from pathlib import Path
from datetime import timedelta
import os
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-le9sz&mbmod5#%0=8%+h4=acpb_uc1s_-@s2xpor1k=fw)s2t8'

DEBUG = False

ALLOWED_HOSTS = ['*']


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'corsheaders',
    # Local
    'core',
    'scraper',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',       # ← MUST be first
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'UMDSS.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'UMDSS.wsgi.application'


# Database
# Uses Supabase/Postgres when DATABASE_URL is set (production, e.g. Render),
# and falls back to local SQLite when it isn't (local dev).

import dj_database_url

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=True,  # Supabase requires SSL
        )
    }
else:
    DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ──────────────────────────────────────────────────────
# CORS — allow React dev server
# ──────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://10.138.91.232:3000',
    os.environ.get('FRONTEND_URL', 'http://localhost:3000'),
    "https://scholarcircle.vercel.app",
]
CORS_ALLOW_CREDENTIALS = True


# ──────────────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}


# ──────────────────────────────────────────────────────
# Simple JWT
# ──────────────────────────────────────────────────────

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=4),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ──────────────────────────────────────────────────────
# Celery
# ──────────────────────────────────────────────────────

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_ALWAYS_EAGER = True

CELERY_BEAT_SCHEDULE = {
    'scrape-selenium-sources': {
        'task': 'scraper.tasks.scrape_by_type',
        'schedule': crontab(hour=2, minute=0),
        'args': ('selenium',),
    },
    'scrape-playwright-sources': {
        'task': 'scraper.tasks.scrape_by_type',
        'schedule': crontab(hour=3, minute=0),
        'args': ('playwright',),
    },
    'scrape-generic-sources': {
        'task': 'scraper.tasks.scrape_by_type',
        'schedule': crontab(hour=4, minute=0),
        'args': ('generic',),
    },
    'cleanup-expired-scholarships-weekly': {
        'task': 'scraper.tasks.cleanup_expired_scholarships',
        'schedule': crontab(hour=5, minute=0, day_of_week=1),
    },
}

# Logging — without this the scrapers' progress and failures go nowhere.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'scraper': {'format': '[{levelname}] {name}: {message}', 'style': '{'},
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'scraper',
        },
    },
    'loggers': {
        'scraper': {
            'handlers': ['console'],
            'level': os.environ.get('SCRAPER_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        # Every send, skip and gateway error. Without this the console backend
        # writes to nowhere and a dev cannot tell whether a text "went".
        'sms': {
            'handlers': ['console'],
            'level': os.environ.get('SMS_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'mailer': {
            'handlers': ['console'],
            'level': os.environ.get('EMAIL_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}

# Scraper concurrency limits
CELERY_WORKER_CONCURRENCY = 2
CELERY_TASK_ROUTES = {
    'scraper.tasks.*': {'queue': 'scraper'},
}

# Media settings for Vault Uploads
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

import base64
# 256-bit encryption key (32 bytes encoded in base64)
VAULT_ENCRYPTION_KEY = os.environ.get(
    'VAULT_ENCRYPTION_KEY',
    base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8')
)

# ──────────────────────────────────────────────────────
# SMS
# ──────────────────────────────────────────────────────

# Which gateway to use: 'console' logs the message and sends nothing, 'arkesel'
# is live. Console is the default deliberately, so that a fresh checkout or a
# CI run cannot spend credits no matter what code it runs.
SMS_BACKEND = os.environ.get('SMS_BACKEND', 'console')

ARKESEL_API_KEY = os.environ.get('ARKESEL_API_KEY', '')
# The name recipients see. An alphanumeric sender ID has to be registered and
# approved by the mobile networks themselves before they will carry it, so this
# must match what was approved on the Arkesel dashboard; an unregistered one is
# rejected at send time.
#
# Alphanumeric sender IDs are capped at 11 characters by the GSM standard, so
# the full 'ScholarCircle' (13) will not fit. 'ScholarCirc' is the longest
# truncation that does.
ARKESEL_SENDER_ID = os.environ.get('ARKESEL_SENDER_ID', 'ScholarCirc')

# Master switch, kept separate from the credentials so sending can be stopped
# in production by flipping one variable rather than deleting the API key.
SMS_ENABLED = os.environ.get('SMS_ENABLED', 'true').lower() == 'true'

# Ceiling on texts across the whole install in any rolling 24 hours. This is a
# blast radius limit rather than a business rule: a bug that starts texting in
# a loop stops here instead of at the bottom of the prepaid balance.
SMS_DAILY_CAP = int(os.environ.get('SMS_DAILY_CAP', '200'))

# One GSM-7 segment. See core.sms.dispatch._trim for why overrunning it costs
# more than it looks.
SMS_MAX_LENGTH = int(os.environ.get('SMS_MAX_LENGTH', '160'))

SMS_TIMEOUT_SECONDS = int(os.environ.get('SMS_TIMEOUT_SECONDS', '15'))

# Do-not-disturb window, as hours on a 24-hour clock. TIME_ZONE is UTC and
# Ghana keeps GMT all year, so these read as Accra local hours with no
# conversion. Set both to the same value to disable.
SMS_QUIET_HOURS_START = int(os.environ.get('SMS_QUIET_HOURS_START', '21'))
SMS_QUIET_HOURS_END = int(os.environ.get('SMS_QUIET_HOURS_END', '6'))

# ──────────────────────────────────────────────────────
# Email
# ──────────────────────────────────────────────────────
#
# Deliberately not called EMAIL_BACKEND: Django already owns that name for
# django.core.mail, and reusing it would quietly hijack every send_mail call in
# the project.
EMAIL_PROVIDER = os.environ.get('EMAIL_PROVIDER', 'console')

BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '')
# Brevo only sends from a verified sender or a verified domain and rejects
# anything else with a 400, so this must match a sender listed on the account.
# Verifying a real domain is what lifts that restriction, and it is also what
# fixes the DMARC problem of sending mail "from" a gmail.com address through a
# third party — strict receivers will spam-folder or drop that.
BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL', '')
# Display name only. Free text, never verified, safe to change at any time.
BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'ScholarCircle')

EMAIL_ENABLED = os.environ.get('EMAIL_ENABLED', 'true').lower() == 'true'

# Brevo's free plan allows 300 sends a day. Staying under it leaves headroom
# for anything added later that also needs to mail a student.
EMAIL_DAILY_CAP = int(os.environ.get('EMAIL_DAILY_CAP', '250'))

EMAIL_TIMEOUT_SECONDS = int(os.environ.get('EMAIL_TIMEOUT_SECONDS', '15'))

