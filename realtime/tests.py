
from asgiref.sync import async_to_sync
from django.test import SimpleTestCase, override_settings

from channels.testing import WebsocketCommunicator
from channels.layers import get_channel_layer
from channels.routing import URLRouter

from realtime.routing import websocket_urlpatterns


test_application = URLRouter(websocket_urlpatterns)


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }
)
class CalendarBroadcastTests(SimpleTestCase):

    def test_broadcast_reaches_two_clients(self):
        async_to_sync(self.check_broadcast)()

    async def check_broadcast(self):
        client_a = WebsocketCommunicator(
            test_application,
            "/ws/calendar/",
        )

        client_b = WebsocketCommunicator(
            test_application,
            "/ws/calendar/",
        )

        connected_a = False
        connected_b = False

        try:
            connected_a, close_code_a = await client_a.connect()

            self.assertTrue(
                connected_a,
                f"Client A rejected with code: {close_code_a}",
            )

            connected_b, close_code_b = await client_b.connect()

            self.assertTrue(
                connected_b,
                f"Client B rejected with code: {close_code_b}",
            )

            welcome_a = await client_a.receive_json_from(timeout=2)
            welcome_b = await client_b.receive_json_from(timeout=2)

            self.assertEqual(
                welcome_a["type"],
                "connection_established",
            )

            self.assertEqual(
                welcome_b["type"],
                "connection_established",
            )

            channel_layer = get_channel_layer()

            event_payload = {
                "type": "event_created",
                "data": {
                    "id": 1,
                    "name": "Python Workshop",
                },
            }

            await channel_layer.group_send(
                "calendar_updates",
                {
                    "type": "calendar.broadcast",
                    "data": event_payload,
                },
            )

            message_a = await client_a.receive_json_from(timeout=2)
            message_b = await client_b.receive_json_from(timeout=2)

            self.assertEqual(message_a, event_payload)
            self.assertEqual(message_b, event_payload)

        finally:
            if connected_a:
                await client_a.disconnect()

            if connected_b:
                await client_b.disconnect()
