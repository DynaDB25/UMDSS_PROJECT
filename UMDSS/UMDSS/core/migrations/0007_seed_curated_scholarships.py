"""Retired: this migration used to seed the curated fallback catalogue.

It originally ran on every Render deploy and upserted the hand-written
scholarships from scraper/scrapers/fallbacks.py into the database as
origin='seeded'. That was the mechanism that kept demo rows — with invented
deadlines and no source link — reappearing in production after every deploy.

Under the strict-provenance rule the app now shows only live-scraped,
source-linked scholarships, so both the fallback catalogue and this seeding
step have been removed. The migration node is kept (it has already been applied
in production) but its forward operation is now a deliberate no-op.

Existing seeded rows are removed separately by `manage.py purge_unverified`; a
migration is the wrong place to delete data a deploy might not expect to lose.
"""
from django.db import migrations


def noop(apps, schema_editor):
    """Previously seeded curated scholarships. Intentionally does nothing now."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_alter_scholarship_deadline'),
    ]

    operations = [
        migrations.RunPython(noop, noop),
    ]
