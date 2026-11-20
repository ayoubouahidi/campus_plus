from django.contrib.auth import authenticate, get_user_model
from django.test import RequestFactory
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from unittest.mock import patch

from core_data.models import Club, Department, UserMember
from dashboard.models import AuditLog
from .permissions import IsClubBoard, IsSuperAdmin, user_club_id


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

        self.assertEqual(
            set(response.data["user"]),
            {
                "id",
                "email",
                "full_name",
                "login",
                "avatar_url",
                "campus",
                "role",
                "club_id",
                "club_slug",
            },
        )
        self.assertTrue(response.data["token"])
        self.assertIsInstance(response.data["user"]["id"], int)
        user.refresh_from_db()
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(UserMember.objects.count(), 1)
        self.assertEqual(user.username, "student42")
        self.assertEqual(user.role, User.Role.BOARD_MEMBER)
        self.assertEqual(user.email, "student@example.com")
        self.assertEqual(user.first_name, "Test")
        self.assertEqual(user.last_name, "Student")
        self.assertEqual(user.campus, "Benguerir")
        self.assertTrue(Token.objects.filter(user=user).exists())
        self.assertEqual(AuditLog.objects.filter(action="login").count(), 2)

    def test_auth_sync_bootstraps_configured_superadmin(self):
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

    def test_auth_sync_rejects_inactive_accounts(self):
        user = User.objects.create_user(
            username="student42",
            password="unused",
            forty_two_id=4242,
            is_active=False,
        )

        response = self.client.post(
            "/auth/sync",
            self.payload,
            format="json",
            HTTP_X_INTERNAL_KEY="test-internal-key",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Token.objects.filter(user=user).exists())
        self.assertFalse(AuditLog.objects.filter(action="login").exists())


class UserModelContractTests(TestCase):
    def test_user_model_uses_expected_identity_contract(self):
        user = User.objects.create_user(
            username="regular-user",
            password="test-password-123",
        )

        self.assertEqual(User.USERNAME_FIELD, "username")
        self.assertEqual(User._meta.pk.get_internal_type(), "BigAutoField")
        self.assertEqual(User._meta.db_table, "accounts_user")
        self.assertTrue(user.check_password("test-password-123"))
        self.assertEqual(
            authenticate(username="regular-user", password="test-password-123"),
            user,
        )

    def test_user_manager_creates_superusers_with_admin_flags(self):
        user = User.objects.create_superuser(
            username="admin-user",
            password="test-password-123",
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_inactive_users_cannot_authenticate_with_password(self):
        user = User.objects.create_user(
            username="inactive-user",
            password="test-password-123",
            is_active=False,
        )

        self.assertIsNone(
            authenticate(username="inactive-user", password="test-password-123")
        )


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
        self.assertEqual(self.client.get("/api/me/").status_code, 401)


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

    def test_club_head_can_manage_the_club_they_head(self):
        department = Department.objects.create(title="Technology")
        user = User.objects.create_user(
            username="club-head",
            password="unused",
            role=User.Role.STUDENT,
        )
        member = UserMember.objects.create(
            user=user,
            username=user.username,
        )
        club = Club.objects.create(
            name="Robotics",
            department=department,
            head=member,
        )
        request = RequestFactory().get("/")
        request.user = user
        permission = IsClubBoard()

        self.assertTrue(permission.has_permission(request, None))
        self.assertTrue(permission.has_object_permission(request, None, club))

    def test_superadmin_permission_recognizes_role_and_django_superuser(self):
        request = RequestFactory().get("/")
        permission = IsSuperAdmin()

        role_admin = User.objects.create_user(
            username="role-admin",
            password="unused",
            role=User.Role.SUPERADMIN,
        )
        request.user = role_admin
        self.assertTrue(permission.has_permission(request, None))

        django_superuser = User.objects.create_superuser(
            username="django-superuser",
            password="unused",
        )
        request.user = django_superuser
        self.assertTrue(permission.has_permission(request, None))

        request.user = User.objects.create_user(
            username="student",
            password="unused",
        )
        self.assertFalse(permission.has_permission(request, None))
