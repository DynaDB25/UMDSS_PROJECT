"""Seed the curated baseline scholarships as part of migrate.

Render runs `migrate` on deploy, so this guarantees the app is never empty
even without shell access to run `manage.py seed_scholarships`. It mirrors that
command's logic but is fully self-contained (migrations must not depend on
app code that can change later) apart from the static fallback catalogue, which
is imported lazily and guarded. Idempotent: upserts by slug, so re-running on
every deploy never duplicates rows. Any failure is swallowed — seeding data
must never be able to break a deploy's migration step.
"""
from django.db import migrations
from django.utils.text import slugify


_LOGO_COLORS = {
    'Government': 'bg-emerald-600',
    'Corporate': 'bg-amber-500',
    'International': 'bg-indigo-700',
    'Foundation': 'bg-orange-600',
}


def _initials(name):
    return "".join(w[0].upper() for w in name.split() if w and w[0].isalpha())[:4]


def seed(apps, schema_editor):
    Scholarship = apps.get_model('core', 'Scholarship')
    try:
        from scraper.scrapers.fallbacks import all_fallbacks
    except Exception:
        return  # scraper app/catalogue unavailable — nothing to seed

    for rows in all_fallbacks().values():
        for item in rows:
            try:
                provider_type = item.get('provider_type', 'Foundation')
                name = item['name']
                provider = item.get('provider', name)
                slug = slugify(f"{name}-{provider}")[:50]
                Scholarship.objects.update_or_create(
                    slug=slug,
                    defaults={
                        'origin': 'seeded',
                        'source_url': item.get('source_url', ''),
                        'level_scope': item.get('level_scope', 'unknown'),
                        'name': name[:200],
                        'provider': provider[:200],
                        'provider_type': provider_type,
                        'logo_color': _LOGO_COLORS.get(provider_type, 'bg-slate-600'),
                        'initials': _initials(name),
                        'amount': (item.get('amount') or 'Variable')[:100],
                        'amount_value': item.get('amount_value', 0),
                        'deadline': item.get('deadline'),
                        'region': item.get('region', ['All']),
                        'programmes': item.get('programmes', ['All']),
                        'max_aggregate': item.get('max_aggregate', 36),
                        'need_based': item.get('need_based', False),
                        'slots': item.get('slots', 0),
                        'summary': item.get('summary', ''),
                        'benefits': item.get('benefits', []),
                        'documents': item.get('documents', []),
                        'tags': item.get('tags', []),
                    },
                )
            except Exception:
                continue  # skip a bad row, never fail the migration


def unseed(apps, schema_editor):
    # Non-destructive reverse: leave seeded rows in place.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_alter_scholarship_deadline'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
