from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from core_data.models import UserMember

User = get_user_model()


def image_upload(color):
    output = BytesIO()
    Image.new("RGB", (16, 16), color=color).save(output, format="PNG")
    return SimpleUploadedFile("avatar.png", output.getvalue(), content_type="image/png")


@override_settings(BACKEND_INTERNAL_KEY="avatar-test-key")
class AvatarLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="avatar-student",
            password="unused",
            email="avatar@student.1337.ma",
            forty_two_id=4242,
        )
        self.client.force_authenticate(self.user)

    def test_replacing_avatar_deletes_the_previous_file(self):
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            first = self.client.post("/api/me/avatar/", {"file": image_upload("red")}, format="multipart")
            self.assertEqual(first.status_code, 200, first.data)
            member = UserMember.objects.get(user=self.user)
            old_path = member.image_path.path
            self.assertTrue(__import__("os").path.exists(old_path))

            second = self.client.post("/api/me/avatar/", {"file": image_upload("blue")}, format="multipart")
            self.assertEqual(second.status_code, 200, second.data)
            member.refresh_from_db()
            self.assertNotEqual(member.image_path.path, old_path)
            self.assertFalse(__import__("os").path.exists(old_path))
            self.user.refresh_from_db()
            self.assertTrue(self.user.avatar_is_custom)

    def test_42_sync_preserves_a_custom_uploaded_avatar(self):
        with TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root,
            DJANGO_PUBLIC_MEDIA_BASE_URL="https://campushub.test",
        ):
            uploaded = self.client.post("/api/me/avatar/", {"file": image_upload("green")}, format="multipart")
            self.assertEqual(uploaded.status_code, 200, uploaded.data)
            self.user.refresh_from_db()
            custom_url = self.user.avatar_url

            with patch("accounts.views.get_campus_allow_list", return_value={"benguerir"}):
                synced = APIClient().post(
                    "/auth/sync",
                    {
                        "fortyTwoId": 4242,
                        "login": "avatar-student",
                        "email": "avatar@student.1337.ma",
                        "firstName": "Avatar",
                        "lastName": "Student",
                        "imageUrl": "https://42.example/avatar.jpg",
                        "campus": "Benguerir",
                    },
                    format="json",
                    HTTP_X_INTERNAL_KEY="avatar-test-key",
                )
            self.assertEqual(synced.status_code, 200, synced.data)
            self.user.refresh_from_db()
            self.assertTrue(self.user.avatar_is_custom)
            self.assertEqual(self.user.avatar_url, custom_url)
            self.assertEqual(synced.data["user"]["avatar_url"], custom_url)
