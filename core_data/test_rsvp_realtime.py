import asyncio
from contextlib import AsyncExitStack, asynccontextmanager
from datetime import timedelta
from threading import Barrier

from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.db import connections, transaction
from django.test import TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from core_data.models import ClubEvent, Department, Rsvp
from notifications.models import Notification
from realtime.authentication import get_websocket_auth_stack
from realtime.routing import websocket_urlpatterns


@override_settings(
    WS_AUTH_BACKEND="jwt",
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}},
    ALLOWED_HOSTS=["testserver", "localhost"],
)
class RsvpRealtimeTests(TransactionTestCase):
    def setUp(self):
        self.app = AllowedHostsOriginValidator(
            get_websocket_auth_stack(URLRouter(websocket_urlpatterns))
        )
        self.users = [
            get_user_model().objects.create_user(
                username=f"rsvp-student-{number}", email=f"private-{number}@example.test"
            )
            for number in range(2)
        ]
        self.api_tokens = [Token.objects.create(user=user).key for user in self.users]
        self.ws_tokens = [str(AccessToken.for_user(user)) for user in self.users]
        start = timezone.now() + timedelta(days=1)
        self.event = ClubEvent.objects.create(
            name="WebSocket event",
            parent_id=Department.objects.create(title="Technology"),
            starts_at=start,
            ends_at=start + timedelta(hours=1),
        )
        self.event_url = f"/api/club-events/{self.event.pk}/"
        self.rsvp_url = f"{self.event_url}rsvp/"

    @asynccontextmanager
    async def subscribe(self, index, stream="calendar"):
        socket = WebsocketCommunicator(
            self.app,
            f"/ws/{stream}/",
            headers=[
                (b"origin", b"https://localhost"),
                (b"cookie", f"ws_access={self.ws_tokens[index]}".encode()),
            ],
        )
        connected, _ = await socket.connect()
        self.assertTrue(connected)
        try:
            self.assertEqual((await socket.receive_json_from())["type"], "connection_established")
            if stream == "notifications":
                self.assertEqual((await socket.receive_json_from())["type"], "notification.unread_count")
            yield socket
        finally:
            await socket.disconnect()

    def client_for(self, index):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.api_tokens[index]}")
        return client

    def mutate(self, method, index=0, *, before_commit=None, rollback=False):
        with transaction.atomic():
            response = getattr(self.client_for(index), method)(self.rsvp_url)
            if before_commit is not None:
                async_to_sync(before_commit)()
            if rollback:
                transaction.set_rollback(True)
            return response

    async def assert_silent(self, *sockets):
        for quiet in await asyncio.gather(
            *(socket.receive_nothing(timeout=0.1) for socket in sockets)
        ):
            self.assertTrue(quiet, "A subscriber received an unexpected message")

    async def assert_calendar_update(self, sockets, count):
        messages = await asyncio.gather(
            *(socket.receive_json_from(timeout=2) for socket in sockets)
        )
        for message in messages:
            self.assertEqual(set(message), {"type", "data"})
            self.assertEqual(message["type"], "event_updated")
            data = message["data"]
            self.assertEqual(data["id"], self.event.pk)
            self.assertEqual(data["rsvps_count"], count)
            self.assertEqual(data["name"], self.event.name)
            self.assertIs(data["has_user_rsvpd"], False)
            self.assertEqual(data["attendees_preview"], [])
            self.assertEqual(set(data), {
                "id", "title", "name", "description", "parent_id", "parent",
                "department_name", "department_slug", "club", "club_id",
                "club_name", "club_slug", "flyer_url", "start_time", "end_time",
                "starts_at", "ends_at", "location", "category", "status", "capacity",
                "created_at", "updated_at", "rsvps_count", "has_user_rsvpd",
                "attendees_preview",
            })

    def test_committed_create_and_cancel_notify_both_calendars_and_only_the_actors_inbox(self):
        async_to_sync(self.check_commit_and_privacy)()

    async def check_commit_and_privacy(self):
        async with AsyncExitStack() as stack:
            calendars = [await stack.enter_async_context(self.subscribe(index)) for index in range(2)]
            inbox, other_inbox = [
                await stack.enter_async_context(self.subscribe(index, "notifications"))
                for index in range(2)
            ]

            async def before_commit():
                await self.assert_silent(*calendars, inbox, other_inbox)

            for method, expected_status, count, notification_type in (
                ("post", 201, 1, Notification.Type.RSVP_CONFIRMED),
                ("delete", 200, 0, Notification.Type.RSVP_CANCELLED),
            ):
                response = await database_sync_to_async(self.mutate)(
                    method, before_commit=before_commit
                )
                self.assertEqual(response.status_code, expected_status)
                await self.assert_calendar_update(calendars, count)
                private = await inbox.receive_json_from(timeout=2)
                self.assertEqual(private["type"], "notification.created")
                self.assertEqual(private["data"]["notification_type"], notification_type)
                self.assertEqual(private["data"]["event_id"], self.event.pk)
                await self.assert_silent(*calendars, inbox, other_inbox)
                for index in range(2):
                    event = await database_sync_to_async(self.client_for(index).get)(self.event_url)
                    self.assertEqual(event.data["rsvps_count"], count)
                    self.assertIs(event.data["has_user_rsvpd"], index == 0 and count == 1)

        self.assertEqual(
            await Notification.objects.filter(recipient=self.users[0]).acount(), 2
        )
        self.assertFalse(await Notification.objects.filter(recipient=self.users[1]).aexists())

    def test_rollbacks_rejections_and_no_ops_do_not_send_messages(self):
        async_to_sync(self.check_no_delivery)()

    async def check_no_delivery(self):
        async with self.subscribe(0) as calendar, self.subscribe(0, "notifications") as inbox:
            response = await database_sync_to_async(self.mutate)("post", rollback=True)
            self.assertEqual(response.status_code, 201)
            await self.assert_silent(calendar, inbox)
            self.assertFalse(await Rsvp.objects.aexists())
            self.assertFalse(await Notification.objects.aexists())

            await Rsvp.objects.acreate(user=self.users[0], event=self.event)
            response = await database_sync_to_async(self.mutate)("delete", rollback=True)
            self.assertEqual(response.status_code, 200)
            await self.assert_silent(calendar, inbox)
            self.assertTrue(await Rsvp.objects.aexists())

            response = await database_sync_to_async(self.mutate)("post")
            self.assertEqual(response.status_code, 200)
            await self.assert_silent(calendar, inbox)

            await Rsvp.objects.all().adelete()
            response = await database_sync_to_async(self.mutate)("delete")
            self.assertEqual(response.status_code, 200)
            await self.assert_silent(calendar, inbox)

            now = timezone.now()
            await ClubEvent.objects.filter(pk=self.event.pk).aupdate(
                starts_at=now - timedelta(hours=2), ends_at=now - timedelta(hours=1)
            )
            response = await database_sync_to_async(self.mutate)("post")
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data["code"], "event_ended")
            await self.assert_silent(calendar, inbox)

        self.assertFalse(await Rsvp.objects.aexists())
        self.assertFalse(await Notification.objects.aexists())

    @skipUnlessDBFeature("has_select_for_update")
    def test_concurrent_registrations_for_the_last_place_publish_only_the_winner(self):
        self.event.capacity = 1
        self.event.save(update_fields=["capacity"])
        async_to_sync(self.check_concurrent_registrations)()

    async def check_concurrent_registrations(self):
        barrier = Barrier(2, timeout=5)

        def register(index):
            try:
                barrier.wait()
                return self.client_for(index).post(self.rsvp_url)
            finally:
                connections.close_all()

        async with self.subscribe(0) as first, self.subscribe(1) as second:
            responses = await asyncio.gather(
                *(asyncio.to_thread(register, index) for index in range(2))
            )
            self.assertEqual(sorted(response.status_code for response in responses), [201, 409])
            self.assertTrue(all(response.data["rsvps_count"] == 1 for response in responses))
            await self.assert_calendar_update((first, second), 1)
            await self.assert_silent(first, second)

        winner = self.users[next(index for index, response in enumerate(responses)
                                 if response.status_code == 201)]
        self.assertEqual(await Rsvp.objects.acount(), 1)
        self.assertEqual((await Rsvp.objects.aget()).user_id, winner.pk)
        self.assertEqual((await Notification.objects.aget()).recipient_id, winner.pk)
