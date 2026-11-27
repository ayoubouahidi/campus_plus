from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core_data.models import ClubEvent, Department, Rsvp
from notifications.models import Notification


User = get_user_model()


class RsvpApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(title="Technology")
        start = timezone.now() + timedelta(days=1)
        self.event = ClubEvent.objects.create(
            name="Synthetic event",
            parent_id=self.department,
            starts_at=start,
            ends_at=start + timedelta(hours=2),
            category="Tech",
            capacity=2,
        )
        self.user = User.objects.create_user(
            username="rsvp-user",
            password="unused",
            first_name="RSVP",
            last_name="Student",
            avatar_url="https://example.test/avatar.png",
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_anonymous_rsvp_and_attendees_are_private(self):
        rsvp_url = f"/api/club-events/{self.event.pk}/rsvp/"
        attendees_url = f"/api/club-events/{self.event.pk}/attendees/"

        self.assertIn(self.client.post(rsvp_url).status_code, {401, 403})
        self.assertIn(self.client.delete(rsvp_url).status_code, {401, 403})
        self.assertIn(self.client.get(attendees_url).status_code, {401, 403})

    def test_create_repeat_and_cancel_are_idempotent(self):
        self.authenticate()
        url = f"/api/club-events/{self.event.pk}/rsvp/"

        created = self.client.post(url)
        repeated = self.client.post(url)
        cancelled = self.client.delete(url)
        absent = self.client.delete(url)

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data, {
            "rsvps_count": 1,
            "has_user_rsvpd": True,
        })
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.data["rsvps_count"], 1)
        self.assertEqual(Rsvp.objects.count(), 0)
        self.assertEqual(cancelled.data, {
            "rsvps_count": 0,
            "has_user_rsvpd": False,
        })
        self.assertEqual(absent.status_code, 200)
        self.assertEqual(absent.data, cancelled.data)

    def test_capacity_is_enforced_without_creating_a_row(self):
        self.event.capacity = 1
        self.event.save(update_fields=["capacity"])
        other = User.objects.create_user(username="already-going", password="unused")
        Rsvp.objects.create(event=self.event, user=other)
        self.authenticate()

        with self.captureOnCommitCallbacks() as callbacks:
            response = self.client.post(f"/api/club-events/{self.event.pk}/rsvp/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["rsvps_count"], 1)
        self.assertFalse(response.data["has_user_rsvpd"])
        self.assertFalse(Rsvp.objects.filter(event=self.event, user=self.user).exists())
        self.assertFalse(Notification.objects.exists())
        self.assertEqual(callbacks, [])

    def test_new_rsvp_is_rejected_at_and_after_end_time(self):
        end = self.event.ends_at
        self.authenticate()
        url = f"/api/club-events/{self.event.pk}/rsvp/"

        for now in (end, end + timedelta(seconds=1)):
            with self.subTest(now=now), patch("core_data.views.timezone.now", return_value=now):
                with self.captureOnCommitCallbacks() as callbacks:
                    response = self.client.post(url)

                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.data, {
                    "code": "event_ended",
                    "detail": "Registration is closed because this event has ended.",
                    "rsvps_count": 0,
                    "has_user_rsvpd": False,
                })
                self.assertFalse(Rsvp.objects.exists())
                self.assertFalse(Notification.objects.exists())
                self.assertEqual(callbacks, [])

    def test_rsvp_retry_and_cancellation_still_work_after_event_ends(self):
        self.authenticate()
        url = f"/api/club-events/{self.event.pk}/rsvp/"
        Rsvp.objects.create(event=self.event, user=self.user)

        with patch("core_data.views.timezone.now", return_value=self.event.ends_at):
            with self.captureOnCommitCallbacks() as retry_callbacks:
                retried = self.client.post(url)
            cancelled = self.client.delete(url)

        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.data, {"rsvps_count": 1, "has_user_rsvpd": True})
        self.assertEqual(retry_callbacks, [])
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.data, {"rsvps_count": 0, "has_user_rsvpd": False})
        self.assertFalse(Rsvp.objects.exists())
        self.assertEqual(Notification.objects.get().notification_type, Notification.Type.RSVP_CANCELLED)

    def test_ongoing_legacy_and_future_cancelled_events_accept_rsvps(self):
        now = timezone.now()
        self.authenticate()
        events = (
            {"starts_at": now - timedelta(hours=1), "ends_at": now + timedelta(hours=1)},
            {"starts_at": now - timedelta(days=1), "ends_at": None},
            {
                "starts_at": now + timedelta(hours=1),
                "ends_at": now + timedelta(hours=2),
                "status": "cancelled",
            },
        )
        for event_details in events:
            with self.subTest(event_details=event_details):
                event = ClubEvent.objects.create(
                    name="Registration allowed",
                    parent_id=self.department,
                    **event_details,
                )
                response = self.client.post(f"/api/club-events/{event.pk}/rsvp/")
                self.assertEqual(response.status_code, 201)
                self.assertTrue(Rsvp.objects.filter(event=event, user=self.user).exists())

    def test_event_responses_include_public_count_and_user_specific_state(self):
        Rsvp.objects.create(event=self.event, user=self.user)

        anonymous = self.client.get(f"/api/club-events/{self.event.pk}/")
        self.authenticate()
        authenticated = self.client.get(f"/api/club-events/{self.event.pk}/")

        self.assertEqual(anonymous.status_code, 200)
        self.assertEqual(anonymous.data["rsvps_count"], 1)
        self.assertFalse(anonymous.data["has_user_rsvpd"])
        self.assertEqual(anonymous.data["attendees_preview"], [])
        self.assertTrue(authenticated.data["has_user_rsvpd"])
        self.assertEqual(authenticated.data["attendees_preview"], [{
            "id": self.user.pk,
            "full_name": "RSVP Student",
            "avatar_url": "https://example.test/avatar.png",
        }])

    def test_attendees_are_paginated_newest_first_and_contain_no_private_data(self):
        users = []
        for number in range(4):
            user = User.objects.create_user(
                username=f"attendee-{number}",
                password="unused",
                email=f"private-{number}@example.test",
            )
            users.append(user)
            Rsvp.objects.create(event=self.event, user=user)
        self.authenticate()

        response = self.client.get(f"/api/club-events/{self.event.pk}/attendees/")
        event_response = self.client.get(f"/api/club-events/{self.event.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 4)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [user.pk for user in reversed(users)],
        )
        self.assertTrue(all(set(item) == {"id", "full_name", "avatar_url"}
                            for item in response.data["results"]))
        self.assertEqual(len(event_response.data["attendees_preview"]), 3)
        self.assertEqual(
            [item["id"] for item in event_response.data["attendees_preview"]],
            [user.pk for user in reversed(users[-3:])],
        )

    def test_unknown_event_returns_not_found_without_side_effects(self):
        self.authenticate()

        response = self.client.post("/api/club-events/999999/rsvp/")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Rsvp.objects.exists())
