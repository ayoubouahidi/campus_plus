"""Event flyers and club logo/banner uploads from the dashboard, end to end through the API."""
import os
from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import ClubBoardAssignment
from core_data.models import Club, ClubEvent, Department

User = get_user_model()


def png(name="image.png", color="purple", size=(32, 32)):
    output = BytesIO()
    Image.new("RGB", size, color=color).save(output, format="PNG")
    return SimpleUploadedFile(name, output.getvalue(), content_type="image/png")


def fake_png():
    return SimpleUploadedFile("fake.png", b"not an image" * 20, content_type="image/png")


def oversized_png():
    return SimpleUploadedFile("big.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * (2 * 1024 * 1024), content_type="image/png")


class UploadTestCase(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media.name, PUBLIC_MEDIA_BASE_URL="https://campushub.test")
        self.override.enable()
        self.department = Department.objects.create(title="1337 Coding School", slug="1337")
        self.club = Club.objects.create(name="LEET Dev", department=self.department)
        self.board = User.objects.create_user(username="board", password="unused", role=User.Role.BOARD_MEMBER)
        ClubBoardAssignment.objects.create(user=self.board, club=self.club)
        self.admin = User.objects.create_user(username="admin", password="unused", role=User.Role.SUPERADMIN)
        self.board_client = self.client_for(self.board)
        self.admin_client = self.client_for(self.admin)

    def tearDown(self):
        self.override.disable()
        self.media.cleanup()

    @staticmethod
    def client_for(user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=user).key}")
        return client

    def event_data(self, **extra):
        start = timezone.now() + timedelta(days=3)
        data = {
            "name": "Workshop",
            "category": "Tech",
            "location": "Lab",
            "club": self.club.pk,
            "parent_id": self.department.pk,
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=2)).isoformat(),
        }
        data.update(extra)
        return data


class EventFlyerTests(UploadTestCase):
    def test_flyer_uploaded_with_a_new_event_is_saved_and_published(self):
        response = self.board_client.post("/api/club-events/", self.event_data(image_path=png("flyer.png")), format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["flyer_url"].startswith("https://campushub.test/media/events_pics/"))
        self.assertNotIn("image_path", response.data)
        event = ClubEvent.objects.get(pk=response.data["id"])
        self.assertTrue(os.path.exists(event.image_path.path))
        public = APIClient().get(f"/api/club-events/{event.pk}/")
        self.assertEqual(public.data["flyer_url"], response.data["flyer_url"])

    def test_editing_without_a_file_keeps_the_flyer_and_a_new_file_replaces_it(self):
        created = self.board_client.post("/api/club-events/", self.event_data(image_path=png("one.png")), format="multipart")
        event_id = created.data["id"]
        kept = self.board_client.patch(f"/api/club-events/{event_id}/", {"name": "Renamed"}, format="multipart")
        self.assertEqual(kept.status_code, 200, kept.data)
        self.assertEqual(kept.data["flyer_url"], created.data["flyer_url"])
        replaced = self.board_client.patch(f"/api/club-events/{event_id}/", {"image_path": png("two.png", "red")}, format="multipart")
        self.assertEqual(replaced.status_code, 200, replaced.data)
        self.assertNotEqual(replaced.data["flyer_url"], created.data["flyer_url"])

    def test_invalid_or_oversized_flyer_is_refused_on_its_field(self):
        for upload in (fake_png(), oversized_png()):
            response = self.board_client.post("/api/club-events/", self.event_data(image_path=upload), format="multipart")
            self.assertEqual(response.status_code, 400)
            self.assertIn("image_path", response.data)
        self.assertFalse(ClubEvent.objects.exists())


class ClubImageTests(UploadTestCase):
    def test_board_uploads_logo_and_banner_and_students_see_them(self):
        response = self.board_client.patch(
            "/api/board/club/",
            {"logo": png("logo.png"), "banner": png("banner.png", size=(120, 40))},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["logo_url"].startswith("https://campushub.test/media/club_logos/"))
        self.assertTrue(response.data["banner_url"].startswith("https://campushub.test/media/club_banners/"))
        public = APIClient().get(f"/api/clubs/{self.club.slug}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["logo_url"], response.data["logo_url"])
        self.assertEqual(public.data["banner_url"], response.data["banner_url"])

    def test_replacing_and_removing_a_logo_deletes_the_old_file(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.board_client.patch("/api/board/club/", {"logo": png("first.png")}, format="multipart")
        self.club.refresh_from_db()
        first_path = self.club.logo.path
        with self.captureOnCommitCallbacks(execute=True):
            self.board_client.patch("/api/board/club/", {"logo": png("second.png", "red")}, format="multipart")
        self.club.refresh_from_db()
        self.assertFalse(os.path.exists(first_path))
        second_path = self.club.logo.path
        with self.captureOnCommitCallbacks(execute=True):
            removed = self.board_client.patch("/api/board/club/", {"remove_logo": "true"}, format="multipart")
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertIsNone(removed.data["logo_url"])
        self.assertFalse(os.path.exists(second_path))

    def test_text_settings_still_work_as_json(self):
        response = self.board_client.patch("/api/board/club/", {"meeting_day": "Monday"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["meeting_day"], "Monday")

    def test_invalid_logo_is_refused_on_its_field(self):
        response = self.board_client.patch("/api/board/club/", {"logo": fake_png()}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("logo", response.data)

    def test_superadmin_creates_an_organization_with_a_logo_and_removes_its_banner(self):
        created = self.admin_client.post(
            "/api/superadmin/organizations/",
            {"name": "Robotics", "department": self.department.pk, "is_active": "true", "logo": png("r.png"), "banner": png("b.png")},
            format="multipart",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data["logo_url"])
        updated = self.admin_client.patch(
            f"/api/superadmin/organizations/{created.data['id']}/",
            {"remove_banner": "true", "is_active": "false"},
            format="multipart",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertIsNone(updated.data["banner_url"])
        self.assertEqual(updated.data["logo_url"], created.data["logo_url"])
        self.assertFalse(updated.data["is_active"])
