"""Replace the em dash placeholder with a plain hyphen.

`submitted_on` and `uploaded_on` are display strings, and their default was an
em dash that rendered straight into the UI. The product now avoids em dashes
entirely, so the default changes and existing rows are rewritten to match.
"""
from django.db import migrations, models


def strip_placeholders(apps, schema_editor):
    Application = apps.get_model('core', 'Application')
    VaultDocument = apps.get_model('core', 'VaultDocument')
    Application.objects.filter(submitted_on='—').update(submitted_on='-')
    VaultDocument.objects.filter(uploaded_on='—').update(uploaded_on='-')


def restore_placeholders(apps, schema_editor):
    Application = apps.get_model('core', 'Application')
    VaultDocument = apps.get_model('core', 'VaultDocument')
    Application.objects.filter(submitted_on='-').update(submitted_on='—')
    VaultDocument.objects.filter(uploaded_on='-').update(uploaded_on='—')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_suggestedapplicationlink'),
    ]

    operations = [
        migrations.AlterField(
            model_name='application',
            name='submitted_on',
            field=models.CharField(default='-', max_length=20),
        ),
        migrations.AlterField(
            model_name='vaultdocument',
            name='uploaded_on',
            field=models.CharField(default='-', max_length=20),
        ),
        migrations.RunPython(strip_placeholders, restore_placeholders),
    ]
