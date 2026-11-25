from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction

from .delivery import deliver_to_user
from .models import Notification


User = get_user_model()
DELIVERY_EVENT_ID_UNSET = object()


def notification_payload(notification):
    return {
        "type": "notification.created",
        "data": {
            "id": notification.pk,
            "notification_type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
            "event_title": notification.event_title,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat().replace("+00:00", "Z"),
            "event_id": notification.event_id,
        },
    }


class NotificationService:
    @classmethod
    def create(
        cls,
        *,
        recipient,
        notification_type,
        title,
        message,
        event=None,
        deduplication_key=None,
        delivery_event_id=DELIVERY_EVENT_ID_UNSET,
    ):
        if not isinstance(recipient, User) or not recipient.pk:
            raise ValidationError("Recipient must be a persisted user.")
        if not recipient.is_active:
            return None, False
        if notification_type not in Notification.Type.values:
            raise ValidationError("Unsupported notification type.")
        if not title or len(title) > 160:
            raise ValidationError("Title must contain 1 to 160 characters.")
        if not message or len(message) > 1000:
            raise ValidationError("Message must contain 1 to 1000 characters.")
        if deduplication_key is not None and (
            not deduplication_key or len(deduplication_key) > 255
        ):
            raise ValidationError(
                "Deduplication key must contain 1 to 255 characters when provided."
            )

        defaults = {
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "event": event,
            "event_title": event.name if event is not None else None,
        }
        with transaction.atomic():
            if deduplication_key is None:
                notification = Notification.objects.create(
                    recipient=recipient,
                    **defaults,
                )
                created = True
            else:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    deduplication_key=deduplication_key,
                    defaults=defaults,
                )

            if created:
                payload = notification_payload(notification)
                if delivery_event_id is not DELIVERY_EVENT_ID_UNSET:
                    payload["data"]["event_id"] = delivery_event_id
                transaction.on_commit(
                    lambda user_id=recipient.pk, data=payload: deliver_to_user(
                        user_id, data
                    ),
                    robust=True,
                )
        return notification, created

    @classmethod
    def create_for_users(cls, *, recipients, **notification_data):
        recipient_ids = set()
        for recipient in recipients:
            recipient_id = recipient.pk if isinstance(recipient, User) else recipient
            if recipient_id is None:
                continue
            if type(recipient_id) is not int or recipient_id <= 0:
                raise ValidationError("Recipients must be persisted users or user IDs.")
            recipient_ids.add(recipient_id)
        users = User.objects.filter(pk__in=recipient_ids, is_active=True)
        created_notifications = []
        with transaction.atomic():
            for user in users.iterator():
                notification, created = cls.create(
                    recipient=user,
                    **notification_data,
                )
                if created:
                    created_notifications.append(notification)
        return created_notifications
