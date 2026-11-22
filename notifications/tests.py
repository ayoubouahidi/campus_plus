import asyncio
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import ClubBoardAssignment
from core_data.models import Club, ClubEvent, Department, Rsvp, UserMember
from realtime.consumers import NotificationConsumer

from .models import Notification
from .services import NotificationService


User = get_user_model()


class NotificationModelAndServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="recipient", password="test-password")

    def test_model_defaults_ordering_and_indexes(self):
        first, _ = NotificationService.create(
            recipient=self.user,
            notification_type=Notification.Type.EVENT_UPDATED,
            title="First",
            message="First message",
        )
        second, _ = NotificationService.create(
            recipient=self.user,
            notification_type=Notification.Type.EVENT_UPDATED,
            title="Second",
            message="Second message",
        )
        self.assertFalse(first.is_read)
        self.assertEqual(list(Notification.objects.values_list("pk", flat=True)), [second.pk, first.pk])
        self.assertGreaterEqual(len(Notification._meta.indexes), 2)

    def test_invalid_type_and_recipient_are_rejected(self):
        with self.assertRaises(ValidationError):
            NotificationService.create(
                recipient=self.user,
                notification_type="not-valid",
                title="Bad",
                message="Bad",
            )
        with self.assertRaises(ValidationError):
            NotificationService.create(
                recipient=object(),
                notification_type=Notification.Type.EVENT_UPDATED,
                title="Bad",
                message="Bad",
            )

    def test_inactive_recipient_is_skipped(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        notification, created = NotificationService.create(
            recipient=self.user,
            notification_type=Notification.Type.EVENT_UPDATED,
            title="Skipped",
            message="Skipped",
        )
        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_deduplication_is_per_recipient(self):
        other = User.objects.create_user(username="other", password="test-password")
        for user in (self.user, self.user, other):
            NotificationService.create(
                recipient=user,
                notification_type=Notification.Type.EVENT_UPDATED,
                title="Update",
                message="Changed",
                deduplication_key="logical-action-1",
            )
        self.assertEqual(Notification.objects.count(), 2)

    @patch("notifications.services.deliver_to_user")
    def test_rollback_persists_and_delivers_nothing(self, mocked_delivery):
        try:
            with transaction.atomic():
                NotificationService.create(
                    recipient=self.user,
                    notification_type=Notification.Type.EVENT_UPDATED,
                    title="Rolled back",
                    message="Rolled back",
                )
                raise RuntimeError("rollback")
        except RuntimeError:
            pass
        self.assertFalse(Notification.objects.exists())
        mocked_delivery.assert_not_called()

    @patch("notifications.services.deliver_to_user", side_effect=RuntimeError("redis unavailable"))
    def test_delivery_failure_does_not_erase_committed_record(self, mocked_delivery):
        with self.captureOnCommitCallbacks(execute=True):
            NotificationService.create(
                recipient=self.user,
                notification_type=Notification.Type.EVENT_UPDATED,
                title="Persistent",
                message="Persistent",
            )
        self.assertEqual(Notification.objects.count(), 1)
        mocked_delivery.assert_called_once()

    def test_deleted_event_keeps_serializable_history(self):
        department = Department.objects.create(title="Engineering")
        event = ClubEvent.objects.create(name="Demo", parent_id=department)
        notification = Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.Type.EVENT_UPDATED,
            title="Update",
            message="Update",
            event=event,
        )
        event.delete()
        notification.refresh_from_db()
        self.assertIsNone(notification.event_id)


class NotificationAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="api-user", password="test-password")
        self.other = User.objects.create_user(username="other-api-user", password="test-password")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.mine = Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.Type.NEW_EVENT,
            title="Mine",
            message="Mine",
        )
        self.theirs = Notification.objects.create(
            recipient=self.other,
            notification_type=Notification.Type.NEW_EVENT,
            title="Theirs",
            message="Theirs",
        )

    def test_anonymous_requests_are_rejected(self):
        response = APIClient().get("/api/notifications/")
        self.assertEqual(response.status_code, 401)

    def test_list_is_paginated_and_user_scoped(self):
        response = self.client.get("/api/notifications/?page_size=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.mine.pk)
        self.assertNotIn("recipient", response.data["results"][0])

    def test_unread_filter_and_count(self):
        read = Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.Type.NEW_EVENT,
            title="Read",
            message="Read",
            is_read=True,
            read_at=timezone.now(),
        )
        response = self.client.get("/api/notifications/?unread=false")
        self.assertEqual([item["id"] for item in response.data["results"]], [read.pk])
        self.assertEqual(self.client.get("/api/notifications/unread-count/").data, {"unread_count": 1})

    def test_invalid_filter_and_page_size_are_rejected(self):
        self.assertEqual(self.client.get("/api/notifications/?unread=yes").status_code, 400)
        self.assertEqual(self.client.get("/api/notifications/?page_size=1000").status_code, 400)

    def test_mark_read_is_idempotent(self):
        first = self.client.post(f"/api/notifications/{self.mine.pk}/read/")
        self.assertEqual(first.status_code, 200)
        self.mine.refresh_from_db()
        original_read_at = self.mine.read_at
        second = self.client.post(f"/api/notifications/{self.mine.pk}/read/")
        self.mine.refresh_from_db()
        self.assertEqual(second.status_code, 200)
        self.assertEqual(self.mine.read_at, original_read_at)

    def test_cannot_mark_another_users_notification(self):
        response = self.client.post(f"/api/notifications/{self.theirs.pk}/read/")
        self.assertEqual(response.status_code, 404)
        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.is_read)

    def test_mark_all_only_updates_current_user_and_preserves_existing_timestamp(self):
        already_read = Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.Type.NEW_EVENT,
            title="Already",
            message="Already",
            is_read=True,
            read_at=timezone.now(),
        )
        previous = already_read.read_at
        response = self.client.post("/api/notifications/read-all/")
        self.assertEqual(response.data, {"updated_count": 1, "unread_count": 0})
        already_read.refresh_from_db()
        self.theirs.refresh_from_db()
        self.assertEqual(already_read.read_at, previous)
        self.assertFalse(self.theirs.is_read)

    def test_unsupported_writes_are_rejected(self):
        self.assertEqual(self.client.post("/api/notifications/", {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(f"/api/notifications/{self.mine.pk}/read/").status_code, 405)


class NotificationWebSocketTests(SimpleTestCase):
    def setUp(self):
        self.user_a = SimpleNamespace(pk=101, is_authenticated=True, is_active=True)
        self.user_b = SimpleNamespace(pk=202, is_authenticated=True, is_active=True)

    @staticmethod
    def consumer_for(user, *, unread_count=0, jwt_exp=None):
        from unittest.mock import AsyncMock

        consumer = NotificationConsumer()
        consumer.scope = {"user": user, "jwt_exp": jwt_exp}
        consumer.channel_layer = AsyncMock()
        consumer.channel_name = f"test-channel-{getattr(user, 'pk', 'anonymous')}"
        consumer.accept = AsyncMock()
        consumer.close = AsyncMock()
        consumer.send_json = AsyncMock()
        consumer.get_unread_count = AsyncMock(return_value=unread_count)
        return consumer

    def test_anonymous_invalid_and_inactive_connections_rejected(self):
        asyncio.run(self.check_rejected_connections())

    async def check_rejected_connections(self):
        anonymous = SimpleNamespace(pk=None, is_authenticated=False, is_active=False)
        anonymous_consumer = self.consumer_for(anonymous)
        await anonymous_consumer.connect()
        anonymous_consumer.close.assert_awaited_once_with(code=4401)
        anonymous_consumer.channel_layer.group_add.assert_not_awaited()

        self.user_a.is_active = False
        inactive_consumer = self.consumer_for(self.user_a)
        await inactive_consumer.connect()
        inactive_consumer.close.assert_awaited_once_with(code=4401)

        self.user_a.is_active = True
        expired_consumer = self.consumer_for(self.user_a, jwt_exp=0)
        await expired_consumer.connect()
        expired_consumer.close.assert_awaited_once_with(code=4401)

    def test_initial_count_and_history_survive_disconnect(self):
        asyncio.run(self.check_initial_count())

    async def check_initial_count(self):
        consumer = self.consumer_for(self.user_a, unread_count=1)
        await consumer.connect()
        consumer.channel_layer.group_add.assert_awaited_once_with(
            "notifications_user_101", consumer.channel_name
        )
        self.assertEqual(consumer.send_json.await_args_list[0].args[0]["type"], "connection_established")
        self.assertEqual(
            consumer.send_json.await_args_list[1].args[0],
            {"type": "notification.unread_count", "data": {"unread_count": 1}},
        )
        await consumer.disconnect(1000)
        consumer.channel_layer.group_discard.assert_awaited_once_with(
            "notifications_user_101", consumer.channel_name
        )

    def test_personal_isolation_and_multiple_connections(self):
        asyncio.run(self.check_isolation_and_multiple_connections())

    async def check_isolation_and_multiple_connections(self):
        consumer_a1 = self.consumer_for(self.user_a)
        consumer_a2 = self.consumer_for(self.user_a)
        consumer_b = self.consumer_for(self.user_b)
        for consumer in (consumer_a1, consumer_a2, consumer_b):
            await consumer.connect()
        self.assertEqual(consumer_a1.group_name, consumer_a2.group_name)
        self.assertNotEqual(consumer_a1.group_name, consumer_b.group_name)

        payload = {"type": "notification.created", "data": {"id": 7}}
        await consumer_a1.notification_delivery({"data": payload})
        await consumer_a2.notification_delivery({"data": payload})
        self.assertEqual(consumer_a1.send_json.await_args.args[0], payload)
        self.assertEqual(consumer_a2.send_json.await_args.args[0], payload)
        # User B is never dispatched a user-A group event.
        self.assertEqual(consumer_b.send_json.await_count, 2)

        consumer_a1.expired = True
        consumer_a1.send_json.reset_mock()
        await consumer_a1.notification_delivery({"data": payload})
        consumer_a1.send_json.assert_not_awaited()


class NotificationTriggerTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(title="Computer Science")
        self.club = Club.objects.create(name="Robotics", department=self.department)
        self.board = User.objects.create_user(
            username="board", password="test-password", role=User.Role.BOARD_MEMBER
        )
        ClubBoardAssignment.objects.create(user=self.board, club=self.club)
        self.member = User.objects.create_user(username="member", password="test-password")
        self.unrelated = User.objects.create_user(username="unrelated", password="test-password")
        UserMember.objects.create(username="member-profile", user=self.member, club_id=self.club)
        self.client = APIClient()
        self.client.force_authenticate(self.board)

    def event_payload(self, **changes):
        payload = {
            "name": "Robot Day",
            "parent_id": self.department.pk,
            "club": self.club.pk,
            "starts_at": "2026-12-01T10:00:00Z",
            "ends_at": "2026-12-01T12:00:00Z",
            "status": "planned",
            "category": "Tech",
        }
        payload.update(changes)
        return payload

    @patch("notifications.services.deliver_to_user")
    def test_new_event_notifies_only_active_club_members(self, mocked_delivery):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post("/api/club-events/", self.event_payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(Notification.objects.filter(recipient=self.member, notification_type=Notification.Type.NEW_EVENT).exists())
        self.assertFalse(Notification.objects.filter(recipient=self.unrelated).exists())

    def test_event_update_and_cancellation_notify_registered_active_users(self):
        event = ClubEvent.objects.create(name="Robot Day", parent_id=self.department, club=self.club)
        Rsvp.objects.create(user=self.member, event=event)
        self.client.patch(f"/api/club-events/{event.pk}/", {"location": "Hall B"}, format="json")
        self.client.patch(f"/api/club-events/{event.pk}/", {"status": "cancelled"}, format="json")
        types = list(Notification.objects.filter(recipient=self.member).values_list("notification_type", flat=True))
        self.assertCountEqual(types, [Notification.Type.EVENT_UPDATED, Notification.Type.EVENT_CANCELLED])
        self.assertFalse(Notification.objects.filter(recipient=self.unrelated).exists())

    def test_irrelevant_or_rejected_update_creates_nothing(self):
        event = ClubEvent.objects.create(name="Robot Day", parent_id=self.department, club=self.club)
        Rsvp.objects.create(user=self.member, event=event)
        response = self.client.patch(f"/api/club-events/{event.pk}/", {"ends_at": "not-a-date"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Notification.objects.exists())

    def test_rsvp_confirmation_and_cancellation_are_idempotent(self):
        event = ClubEvent.objects.create(name="Robot Day", parent_id=self.department, club=self.club)
        user_client = APIClient()
        user_client.force_authenticate(self.member)
        first = user_client.post(f"/api/club-events/{event.pk}/rsvp/")
        second = user_client.post(f"/api/club-events/{event.pk}/rsvp/")
        cancel = user_client.delete(f"/api/club-events/{event.pk}/rsvp/")
        repeated_cancel = user_client.delete(f"/api/club-events/{event.pk}/rsvp/")
        self.assertEqual((first.status_code, second.status_code, cancel.status_code, repeated_cancel.status_code), (201, 200, 200, 200))
        self.assertEqual(Notification.objects.filter(recipient=self.member, notification_type=Notification.Type.RSVP_CONFIRMED).count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=self.member, notification_type=Notification.Type.RSVP_CANCELLED).count(), 1)


class EventDeletionNotificationTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(title="Event Delete Department")
        self.admin = User.objects.create_superuser(
            username="event-delete-admin",
            password="test-password",
        )
        self.attendee = User.objects.create_user(
            username="event-delete-attendee",
            password="test-password",
        )
        self.unrelated = User.objects.create_user(
            username="event-delete-unrelated",
            password="test-password",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def create_event_with_rsvp(self, status_value, *, attendee=None):
        event = ClubEvent.objects.create(
            name=f"Delete Me {status_value}",
            parent_id=self.department,
            status=status_value,
        )
        Rsvp.objects.create(
            event=event,
            user=attendee or self.attendee,
        )
        return event

    def assert_active_deletion_notifies_attendee(self, status_value):
        event = self.create_event_with_rsvp(status_value)
        event_id = event.pk
        event_name = event.name

        with patch("notifications.services.deliver_to_user") as delivery, patch(
            "core_data.views.broadcast_calendar_event"
        ) as calendar_broadcast, self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/club-events/{event_id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(ClubEvent.objects.filter(pk=event_id).exists())
        self.assertFalse(Rsvp.objects.filter(event_id=event_id).exists())

        notification = Notification.objects.get(recipient=self.attendee)
        self.assertEqual(
            notification.notification_type,
            Notification.Type.EVENT_CANCELLED,
        )
        self.assertIn(event_name, notification.message)
        self.assertIsNone(notification.event_id)
        self.assertFalse(Notification.objects.filter(recipient=self.unrelated).exists())
        delivery.assert_called_once()
        self.assertIsNone(delivery.call_args.args[1]["data"]["event_id"])
        calendar_broadcast.assert_called_once_with(
            "event_deleted",
            {"id": event_id},
        )

    def test_deleting_planned_event_notifies_rsvp_attendee(self):
        self.assert_active_deletion_notifies_attendee("planned")

    def test_deleting_ongoing_event_notifies_rsvp_attendee(self):
        self.assert_active_deletion_notifies_attendee("ongoing")

    def test_deleting_cancelled_event_creates_no_additional_notification(self):
        event = self.create_event_with_rsvp("cancelled")
        existing = Notification.objects.create(
            recipient=self.attendee,
            notification_type=Notification.Type.EVENT_CANCELLED,
            title="Event cancelled",
            message=f'"{event.name}" was cancelled.',
            event=event,
            deduplication_key=f"event-change:{event.pk}:cancelled",
        )

        response = self.client.delete(f"/api/club-events/{event.pk}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Notification.objects.filter(recipient=self.attendee).count(), 1)
        existing.refresh_from_db()
        self.assertIsNone(existing.event_id)

    def test_deleting_completed_event_creates_no_notification(self):
        event = self.create_event_with_rsvp("completed")

        response = self.client.delete(f"/api/club-events/{event.pk}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Notification.objects.exists())

    def test_inactive_rsvp_attendee_is_not_notified(self):
        self.attendee.is_active = False
        self.attendee.save(update_fields=["is_active"])
        event = self.create_event_with_rsvp("planned")

        response = self.client.delete(f"/api/club-events/{event.pk}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Notification.objects.exists())

    def test_outer_rollback_preserves_event_and_sends_nothing(self):
        event = self.create_event_with_rsvp("planned")

        with patch("notifications.services.deliver_to_user") as delivery, patch(
            "core_data.views.broadcast_calendar_event"
        ) as calendar_broadcast:
            with self.assertRaisesRegex(RuntimeError, "force rollback"):
                with transaction.atomic():
                    from core_data.views import ClubEventViewSet

                    ClubEventViewSet().perform_destroy(event)
                    raise RuntimeError("force rollback")

        self.assertTrue(ClubEvent.objects.filter(pk=event.pk).exists())
        self.assertTrue(Rsvp.objects.filter(event=event, user=self.attendee).exists())
        self.assertFalse(Notification.objects.exists())
        delivery.assert_not_called()
        calendar_broadcast.assert_not_called()

    def test_existing_delete_permission_still_rejects_unrelated_student(self):
        event = self.create_event_with_rsvp("planned")
        self.client.force_authenticate(self.unrelated)

        response = self.client.delete(f"/api/club-events/{event.pk}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(ClubEvent.objects.filter(pk=event.pk).exists())
        self.assertTrue(Rsvp.objects.filter(event=event).exists())
        self.assertFalse(Notification.objects.exists())
