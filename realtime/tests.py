
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core_data.models import ClubEvent, Department
from realtime.middleware import TokenAuthMiddleware
from realtime.routing import websocket_urlpatterns


test_application = TokenAuthMiddleware(
    URLRouter(websocket_urlpatterns)
)


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }
)
class CalendarBroadcastTests(TransactionTestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="calendar_student",
            password="test_password",
        )

        self.token = Token.objects.create(user=self.user)

    def test_authenticated_clients_receive_broadcast(self):
        async_to_sync(self.check_broadcast)()

    async def check_broadcast(self):
        path = f"/ws/calendar/?token={self.token.key}"

        client_a = WebsocketCommunicator(
            test_application,
            path,
        )

        client_b = WebsocketCommunicator(
            test_application,
            path,
        )

        connected_a = False
        connected_b = False

        try:
            connected_a, _ = await client_a.connect()
            connected_b, _ = await client_b.connect()

            self.assertTrue(connected_a)
            self.assertTrue(connected_b)

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

            payload = {
                "type": "event_created",
                "data": {
                    "id": 1,
                    "name": "Python Workshop",
                },
            }

            channel_layer = get_channel_layer()

            await channel_layer.group_send(
                "calendar_updates",
                {
                    "type": "calendar.broadcast",
                    "data": payload,
                },
            )

            message_a = await client_a.receive_json_from(timeout=2)
            message_b = await client_b.receive_json_from(timeout=2)

            self.assertEqual(message_a, payload)
            self.assertEqual(message_b, payload)

        finally:
            if connected_a:
                await client_a.disconnect()

            if connected_b:
                await client_b.disconnect()

    def test_anonymous_connection_is_rejected(self):
        async_to_sync(self.check_anonymous)()

    async def check_anonymous(self):
        client = WebsocketCommunicator(
            test_application,
            "/ws/calendar/",
        )

        connected, _ = await client.connect()

        self.assertFalse(connected)

    def test_invalid_token_is_rejected(self):
        async_to_sync(self.check_invalid_token)()

    async def check_invalid_token(self):
        client = WebsocketCommunicator(
            test_application,
            "/ws/calendar/?token=invalid_token",
        )

        connected, _ = await client.connect()

        self.assertFalse(connected)

    def test_inactive_user_is_rejected(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        async_to_sync(self.check_inactive_user)()

    async def check_inactive_user(self):
        client = WebsocketCommunicator(
            test_application,
            f"/ws/calendar/?token={self.token.key}",
        )

        connected, _ = await client.connect()

        self.assertFalse(connected)


    def test_revoked_token_is_rejected(self):
        old_key = self.token.key
        self.token.delete()

        async_to_sync(self.check_revoked_token)(old_key)

    async def check_revoked_token(self, old_key):
        client = WebsocketCommunicator(
            test_application,
            f"/ws/calendar/?token={old_key}",
        )

        connected, _ = await client.connect()

        self.assertFalse(connected)

    def test_duplicate_tokens_are_rejected(self):
        async_to_sync(self.check_duplicate_tokens)()

    async def check_duplicate_tokens(self):
        client = WebsocketCommunicator(
            test_application,
            f"/ws/calendar/?token={self.token.key}&token=invalid",
        )

        connected, _ = await client.connect()

        self.assertFalse(connected)


class AutomaticEventBroadcastTests(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            username="test_admin",
            password="test_password",
            is_staff=True,
        )

        self.client.force_authenticate(user=self.admin)

        self.department = Department.objects.create(
            title="Computer Science",
        )

    @patch("core_data.views.broadcast_calendar_event")
    def test_event_creation_broadcasts(self, mock_broadcast):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/club-events/",
                {
                    "name": "Python Workshop",
                    "description": "Introduction to Python",
                    "parent_id": self.department.id,
                    "location": "1337 Campus",
                    "status": "planned",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ClubEvent.objects.count(), 1)

        mock_broadcast.assert_called_once()

        event_type, event_data = mock_broadcast.call_args.args

        self.assertEqual(event_type, "event_created")
        self.assertEqual(event_data["name"], "Python Workshop")
        self.assertEqual(event_data["id"], response.data["id"])

    @patch("core_data.views.broadcast_calendar_event")
    def test_event_update_broadcasts(self, mock_broadcast):
        event = ClubEvent.objects.create(
            name="Python Workshop",
            parent_id=self.department,
            location="1337 Campus",
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/club-events/{event.id}/",
                {
                    "location": "Main Hall",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 200)

        event.refresh_from_db()

        self.assertEqual(event.location, "Main Hall")
        mock_broadcast.assert_called_once()

        event_type, event_data = mock_broadcast.call_args.args

        self.assertEqual(event_type, "event_updated")
        self.assertEqual(event_data["id"], event.id)
        self.assertEqual(event_data["location"], "Main Hall")

    @patch("core_data.views.broadcast_calendar_event")
    def test_event_deletion_broadcasts(self, mock_broadcast):
        event = ClubEvent.objects.create(
            name="Python Workshop",
            parent_id=self.department,
        )

        event_id = event.id

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(
                f"/api/club-events/{event_id}/"
            )

        self.assertEqual(response.status_code, 204)

        self.assertFalse(
            ClubEvent.objects.filter(id=event_id).exists()
        )

        mock_broadcast.assert_called_once_with(
            "event_deleted",
            {"id": event_id},
        )

    @patch("core_data.views.broadcast_calendar_event")
    def test_regular_user_cannot_modify_event(self, mock_broadcast):
        event = ClubEvent.objects.create(
            name="Python Workshop",
            parent_id=self.department,
            location="1337 Campus",
        )

        regular_user = User.objects.create_user(
            username="regular_student",
            password="test_password",
        )

        self.client.force_authenticate(user=regular_user)

        with self.captureOnCommitCallbacks(execute=True):
            update_response = self.client.patch(
                f"/api/club-events/{event.id}/",
                {
                    "location": "Unauthorized change",
                },
                format="json",
            )

            delete_response = self.client.delete(
                f"/api/club-events/{event.id}/"
            )

        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)

        event.refresh_from_db()

        self.assertEqual(event.location, "1337 Campus")

        self.assertTrue(
            ClubEvent.objects.filter(id=event.id).exists()
        )

        mock_broadcast.assert_not_called()

    @patch("core_data.views.broadcast_calendar_event")
    def test_invalid_event_creation_does_not_broadcast(self, mock_broadcast):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/club-events/",
                {
                    "description": "Missing required event name",
                    "parent_id": self.department.id,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ClubEvent.objects.count(), 0)

        mock_broadcast.assert_not_called()

    @patch("core_data.views.broadcast_calendar_event")
    def test_invalid_event_update_does_not_broadcast(self, mock_broadcast):
        event = ClubEvent.objects.create(
            name="Python Workshop",
            parent_id=self.department,
            status="planned",
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/club-events/{event.id}/",
                {
                    "status": "invalid_status",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)

        event.refresh_from_db()
        self.assertEqual(event.status, "planned")

        mock_broadcast.assert_not_called()

    @patch("core_data.views.broadcast_calendar_event")
    def test_unauthenticated_user_cannot_delete_event(self, mock_broadcast):
        event = ClubEvent.objects.create(
            name="Python Workshop",
            parent_id=self.department,
        )

        self.client.force_authenticate(user=None)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(
                f"/api/club-events/{event.id}/"
            )

        self.assertIn(response.status_code, (401, 403))

        self.assertTrue(
            ClubEvent.objects.filter(id=event.id).exists()
        )

        mock_broadcast.assert_not_called()
