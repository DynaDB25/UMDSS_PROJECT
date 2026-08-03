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

