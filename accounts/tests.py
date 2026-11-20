from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core_data.models import Club, Department, UserMember
from dashboard.models import AuditLog
from .permissions import IsClubBoard, user_club_id


User = get_user_model()


@override_settings(BACKEND_INTERNAL_KEY="test-internal-key")
class AuthSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            "fortyTwoId": 4242,
            "login": "student42",
            "email": "student@example.com",
            "firstName": "Test",
            "lastName": "Student",
            "imageUrl": "https://example.com/avatar.png",
            "campus": "Benguerir",
        }

    def test_auth_sync_requires_internal_key(self):
        response = self.client.post("/auth/sync", self.payload, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.exists())

    def test_auth_sync_is_idempotent_and_preserves_existing_role(self):
        department = Department.objects.create(title="Technology")
        club = Club.objects.create(name="Robotics", department=department)
        user = User.objects.create_user(
            username="old-login",
            password="irrelevant",
            forty_two_id=4242,
            role=User.Role.BOARD_MEMBER,
        )
        UserMember.objects.create(
            username="old-login",
            user=user,
            club_id=club,
        )

        for _ in range(2):
            response = self.client.post(
                "/auth/sync",
                self.payload,
                format="json",
                HTTP_X_INTERNAL_KEY="test-internal-key",
            )
            self.assertEqual(response.status_code, 200)

        user.refresh_from_db()
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(UserMember.objects.count(), 1)
        self.assertEqual(user.username, "student42")
        self.assertEqual(user.role, User.Role.BOARD_MEMBER)
        self.assertEqual(user.email, "student@example.com")
        self.assertTrue(Token.objects.filter(user=user).exists())
        self.assertEqual(AuditLog.objects.filter(action="login").count(), 2)

    def test_auth_sync_bootstraps_configured_superadmin(self):
        from unittest.mock import patch

        with patch.dict("os.environ", {"SUPERADMIN_LOGINS": "student42"}):
            response = self.client.post(
                "/auth/sync",
                self.payload,
                format="json",
                HTTP_X_INTERNAL_KEY="test-internal-key",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.get().role, User.Role.SUPERADMIN)

    def test_auth_sync_does_not_promote_existing_user(self):
        user = User.objects.create_user(
            username="student42",
            password="unused",
            forty_two_id=4242,
            role=User.Role.BOARD_MEMBER,
        )
        from unittest.mock import patch

        with patch.dict("os.environ", {"SUPERADMIN_LOGINS": "student42"}):
            response = self.client.post(
                "/auth/sync",
                self.payload,
                format="json",
                HTTP_X_INTERNAL_KEY="test-internal-key",
            )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.role, User.Role.BOARD_MEMBER)


class UserApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="profile-user",
            password="unused",
            email="profile@example.com",
            first_name="Profile",
            last_name="User",
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_me_requires_authentication_and_returns_user_shape(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "Profile User")
        self.assertEqual(response.data["role"], User.Role.STUDENT)
        self.assertIsNone(response.data["club_id"])

    def test_me_only_updates_phone(self):
        response = self.client.patch("/api/me/", {"phone": "+123456"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "+123456")
        self.assertEqual(self.user.username, "profile-user")

    def test_logout_deletes_token(self):
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Token.objects.filter(user=self.user).exists())


class ClubBoardPermissionTests(TestCase):
    def test_board_member_access_is_limited_to_their_club(self):
        department = Department.objects.create(title="Technology")
        own_club = Club.objects.create(name="Robotics", department=department)
        other_club = Club.objects.create(name="Arts", department=department)
        user = User.objects.create_user(
            username="board-user",
            password="unused",
            role=User.Role.BOARD_MEMBER,
        )
        UserMember.objects.create(
            user=user,
            username=user.username,
            club_id=own_club,
        )
        request = RequestFactory().get("/")
        request.user = user
        permission = IsClubBoard()

        self.assertEqual(user_club_id(user), own_club.pk)
        self.assertTrue(permission.has_permission(request, None))
        self.assertTrue(permission.has_object_permission(request, None, own_club))
        self.assertFalse(permission.has_object_permission(request, None, other_club))
