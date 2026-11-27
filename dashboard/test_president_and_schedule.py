"""Club president (chosen from the board team) and events that must start in the future."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import ClubBoardAssignment
from core_data.models import Club, ClubEvent, Department

User = get_user_model()


def client_for(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=user).key}")
    return client


class PresidentTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(title="1337 Coding School", slug="1337")
        self.club = Club.objects.create(name="LEET Dev", department=self.department)
        self.other_club = Club.objects.create(name="Arts", department=self.department)
        self.board = User.objects.create_user(
            username="sara", email="sara@example.com", password="unused",
            first_name="Sara", last_name="Alami", phone="0612345678", role=User.Role.BOARD_MEMBER,
        )
        ClubBoardAssignment.objects.create(user=self.board, club=self.club)
        self.outsider = User.objects.create_user(username="other", password="unused", role=User.Role.BOARD_MEMBER)
        ClubBoardAssignment.objects.create(user=self.outsider, club=self.other_club)
        self.student = User.objects.create_user(username="student", email="s@example.com", password="unused")
        self.admin = User.objects.create_user(username="admin", password="unused", role=User.Role.SUPERADMIN)
        self.board_client = client_for(self.board)
        self.admin_client = client_for(self.admin)

    def test_board_sets_a_president_and_signed_in_students_see_the_contact(self):
        response = self.board_client.patch("/api/board/club/", {"president": self.board.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["president"]["name"], "Sara Alami")
        self.assertEqual(response.data["president"]["phone"], "0612345678")
        public = client_for(self.student).get(f"/api/clubs/{self.club.slug}/")
        self.assertEqual(public.data["president_name"], "Sara Alami")
        self.assertEqual(public.data["president_email"], "sara@example.com")
        self.assertEqual(public.data["president_phone"], "0612345678")
        anonymous = APIClient().get(f"/api/clubs/{self.club.slug}/")
        self.assertEqual(anonymous.data["president_name"], "Sara Alami")
        self.assertNotIn("president_email", anonymous.data)

    def test_president_must_be_on_this_clubs_board(self):
        for value in (self.outsider.pk, self.student.pk, 999999, "abc"):
            response = self.board_client.patch("/api/board/club/", {"president": value}, format="json")
            self.assertEqual(response.status_code, 400, value)
            self.assertIn("president", response.data)
        self.club.refresh_from_db()
        self.assertIsNone(self.club.head)

    def test_clearing_and_superadmin_assignment(self):
        self.admin_client.patch(f"/api/superadmin/organizations/{self.club.pk}/", {"president": self.board.pk}, format="json")
        self.club.refresh_from_db()
        self.assertEqual(self.club.head.user, self.board)
        cleared = self.admin_client.patch(f"/api/superadmin/organizations/{self.club.pk}/", {"president": ""}, format="json")
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertIsNone(cleared.data["president"])

    def test_leaving_the_board_ends_the_presidency(self):
        self.board_client.patch("/api/board/club/", {"president": self.board.pk}, format="json")
        moved = self.admin_client.patch(
            f"/api/superadmin/users/{self.board.pk}/",
            {"role": "BOARD_MEMBER", "club_id": self.other_club.pk},
            format="json",
        )
        self.assertEqual(moved.status_code, 200, moved.data)
        self.club.refresh_from_db()
        self.assertIsNone(self.club.head)


class EventScheduleTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(title="1337 Coding School", slug="1337")
        self.club = Club.objects.create(name="LEET Dev", department=self.department)
        board = User.objects.create_user(username="board", password="unused", role=User.Role.BOARD_MEMBER)
        ClubBoardAssignment.objects.create(user=board, club=self.club)
        self.client = client_for(board)

    def payload(self, start):
        return {
            "name": "Workshop", "category": "Tech", "location": "Lab",
            "club": self.club.pk, "parent_id": self.department.pk,
            "starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat(),
        }

    def test_new_event_in_the_past_is_refused_on_starts_at(self):
        response = self.client.post("/api/club-events/", self.payload(timezone.now() - timedelta(minutes=5)), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("starts_at", response.data)

    def test_time_zone_offsets_are_compared_correctly(self):
        # 10 minutes from now, written in Morocco's offset (+01:00): still in the future.
        start = (timezone.now() + timedelta(minutes=10)).astimezone(timezone.get_fixed_timezone(60))
        response = self.client.post("/api/club-events/", self.payload(start), format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_running_event_can_still_be_renamed_or_cancelled_but_not_moved_to_the_past(self):
        now = timezone.now().replace(second=0, microsecond=0)
        event = ClubEvent.objects.create(
            name="Live", category="Tech", location="Lab", club=self.club, parent_id=self.department,
            starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=1),
        )
        renamed = self.client.patch(
            f"/api/club-events/{event.pk}/",
            {"name": "Live (renamed)", "status": "cancelled", "starts_at": event.starts_at.isoformat(), "ends_at": event.ends_at.isoformat()},
            format="json",
        )
        self.assertEqual(renamed.status_code, 200, renamed.data)
        moved = self.client.patch(
            f"/api/club-events/{event.pk}/",
            {"starts_at": (now - timedelta(hours=3)).isoformat()},
            format="json",
        )
        self.assertEqual(moved.status_code, 400)
        self.assertIn("starts_at", moved.data)
