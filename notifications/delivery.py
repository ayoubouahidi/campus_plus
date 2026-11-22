import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


logger = logging.getLogger(__name__)


def user_group_name(user_id):
    return f"notifications_user_{user_id}"


def deliver_to_user(user_id, payload):
    """Best-effort live delivery; PostgreSQL remains authoritative."""
    try:
        async_to_sync(get_channel_layer().group_send)(
            user_group_name(user_id),
            {"type": "notification.delivery", "data": payload},
        )
    except Exception:
        # Do not log payloads or recipient details.
        logger.exception("Personal notification live delivery failed")


def deliver_unread_count(user_id, unread_count):
    deliver_to_user(user_id, {
        "type": "notification.unread_count",
        "data": {"unread_count": unread_count},
    })
