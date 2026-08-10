from django.contrib import admin

from .models import OutboundMessage


@admin.register(OutboundMessage)
class OutboundMessageAdmin(admin.ModelAdmin):
    """The delivery log, read-only.

    This exists to answer one question quickly: a student says their reminder
    never arrived, and you need to see whether it was sent, rejected by the
    provider, or skipped because their number or address was unusable. Editing
    a log entry would only make that answer less trustworthy, so everything is
    read-only.
    """
    list_display = ('created_at', 'student', 'channel', 'recipient', 'status',
                    'provider', 'error')
    list_filter = ('channel', 'status', 'provider', 'created_at')
    search_fields = ('student__username', 'student__email', 'recipient', 'subject',
                     'body', 'dedupe_key')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]
