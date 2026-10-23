
# [ahmed] Allow synchronous Django code to call async Channels functions.
from asgiref.sync import async_to_sync

# [ahmed] Access the configured Redis channel layer.
from channels.layers import get_channel_layer


# [ahmed] Send an event update to connected calendar clients.
def broadcast_calendar_event(event_type, event_data):
    channel_layer = get_channel_layer()

    # [ahmed] Prepare the WebSocket message.
    payload = {
        "type": event_type,
        "data": event_data,
    }

    # [ahmed] Send the message to all calendar subscribers.
    async_to_sync(channel_layer.group_send)(
        "calendar_updates",
        {
            "type": "calendar.broadcast",
            "data": payload,
        },
    )
