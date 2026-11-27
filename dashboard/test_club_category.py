"""Events take their club's category; only super admins set it."""
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


class ClubCategoryTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(title="1337 Coding School", slug="1337")
        self.club = Club.objects.create(name="Beats", department=self.department, category="Music")
        board = User.objects.create_user(username="board", password="unused", role=User.Role.BOARD_MEMBER)
        ClubBoardAssignment.objects.create(user=board, club=self.club)
        self.board = client_for(board)
        self.admin = client_for(User.objects.create_user(username="admin", password="unused", role=User.Role.SUPERADMIN))

    def create_event(self, **extra):
        start = timezone.now() + timedelta(days=2)
        data = {
            "name": "Jam", "location": "Hall", "club": self.club.pk, "parent_id": self.department.pk,
            "starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat(),
        }
        data.update(extra)
        return self.board.post("/api/club-events/", data, format="json")

    def test_event_takes_the_club_category_without_sending_one(self):
        response = self.create_event()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["category"], "Music")

    def test_a_different_category_in_the_request_is_ignored(self):
        response = self.create_event(category="Gaming")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["category"], "Music")

    def test_changing_the_club_category_updates_its_events(self):
        event_id = self.create_event().data["id"]
        response = self.admin.patch(f"/api/superadmin/organizations/{self.club.pk}/", {"category": "Tech"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["category"], "Tech")
        self.assertEqual(ClubEvent.objects.get(pk=event_id).category, "Tech")
        self.assertEqual(APIClient().get(f"/api/club-events/{event_id}/").data["category"], "Tech")

    def test_super_admin_creates_a_club_with_a_category_and_rejects_unknown_ones(self):
        created = self.admin.post(
            "/api/superadmin/organizations/",
            {"name": "Pixels", "department": self.department.pk, "category": "Gaming", "is_active": True},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["category"], "Gaming")
        bad = self.admin.post(
            "/api/superadmin/organizations/",
            {"name": "Nope", "department": self.department.pk, "category": "Cooking"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        self.assertIn("category", bad.data)

    def test_board_cannot_change_the_category(self):
        response = self.board.patch("/api/board/club/", {"category": "Gaming"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.club.refresh_from_db()
        self.assertEqual(self.club.category, "Music")
