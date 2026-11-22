from django.conf import settings
from django.db import models
from django.db.models import Q


class Notification(models.Model):
    class Type(models.TextChoices):
        NEW_EVENT = "new_event", "New club event"
        EVENT_UPDATED = "event_updated", "Event updated"
        EVENT_CANCELLED = "event_cancelled", "Event cancelled"
        RSVP_CONFIRMED = "rsvp_confirmed", "RSVP confirmed"
        RSVP_CANCELLED = "rsvp_cancelled", "RSVP cancelled"
        CLUB_ANNOUNCEMENT = "club_announcement", "Club announcement"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=Type.choices)
    title = models.CharField(max_length=160)
    message = models.TextField(max_length=1000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    event = models.ForeignKey(
        "core_data.ClubEvent",
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    deduplication_key = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["recipient", "is_read", "-created_at"],
                name="notif_rec_read_created_idx",
            ),
            models.Index(
                fields=["recipient", "-created_at"],
                name="notif_rec_created_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "deduplication_key"],
                condition=Q(deduplication_key__isnull=False),
                name="unique_notification_dedup_per_recipient",
            ),
        ]

    def __str__(self):
        return f"{self.notification_type} for user {self.recipient_id}"
