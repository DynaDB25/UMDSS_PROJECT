from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        # Importing registers the delivery-configuration checks with Django, so
        # `manage.py check` reports a misconfigured SMS or email channel.
        from . import checks  # noqa: F401
