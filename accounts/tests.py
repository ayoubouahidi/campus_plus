from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from unittest.mock import patch
from tempfile import TemporaryDirectory
from io import BytesIO
from PIL import Image

from core_data.models import Club, Department, UserMember
from dashboard.models import AuditLog
from .models import ClubBoardAssignment
from .permissions import IsClubBoard, IsSuperAdmin, user_club_id


User = get_user_model()


@override_settings(BACKEND_INTERNAL_KEY="test-internal-key")
class AuthSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            "fortyTwoId": 4242,
            "login": "student42",
            "email": "Student@Example.com",
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
                "phone",
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

    def test_auth_sync_requires_email_and_rejects_duplicate_email(self):
        missing_email = dict(self.payload)
        missing_email["email"] = ""
        response = self.client.post(
            "/auth/sync",
            missing_email,
            format="json",
            HTTP_X_INTERNAL_KEY="test-internal-key",
        )
        self.assertEqual(response.status_code, 400)

        User.objects.create_user(
            username="existing-email-user",
            password="unused",
            email="taken@example.com",
        )
        duplicate_email = dict(self.payload)
        duplicate_email["email"] = "TAKEN@example.com"
        response = self.client.post(
            "/auth/sync",
            duplicate_email,
            format="json",
            HTTP_X_INTERNAL_KEY="test-internal-key",
        )
        self.assertEqual(response.status_code, 409)
        self.assertFalse(User.objects.filter(forty_two_id=4242).exists())


class EmailPasswordLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="email-login",
            password="secure-password-123",
            email="student@example.com",
        )

    def test_login_returns_the_shared_token_and_user_contract(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "STUDENT@example.com", "password": "secure-password-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["user"]["id"], self.user.pk)
        self.assertTrue(Token.objects.filter(user=self.user).exists())

    def test_login_rejects_bad_credentials_and_inactive_accounts(self):
        invalid_password = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(invalid_password.status_code, 401)

        inactive_user = User.objects.create_user(
            username="inactive-email-login",
            password="secure-password-123",
            email="inactive@example.com",
            is_active=False,
        )
        inactive_response = self.client.post(
            "/api/auth/login/",
            {"email": inactive_user.email, "password": "secure-password-123"},
            format="json",
        )
        self.assertEqual(inactive_response.status_code, 401)

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

    def test_nonblank_email_is_normalized_and_unique_case_insensitively(self):
        user = User.objects.create_user(
            username="normalized-email",
            password="test-password-123",
            email=" Student@Example.com ",
        )
        self.assertEqual(user.email, "student@example.com")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    username="duplicate-email",
                    password="test-password-123",
                    email="STUDENT@example.com",
                )

        User.objects.create_user(
            username="no-email-one",
            password="test-password-123",
        )
        User.objects.create_user(
            username="no-email-two",
            password="test-password-123",
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
        response = self.client.patch(
            "/api/me/",
            {"phone": "06 12 34 56 78"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "+212612345678")
        self.assertEqual(self.user.username, "profile-user")

    def test_me_rejects_invalid_phone_and_allows_clearing_it(self):
        invalid = self.client.patch(
            "/api/me/",
            {"phone": "+123456"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(
            invalid.data["phone"][0],
            "Enter a valid Moroccan mobile number.",
        )

        cleared = self.client.patch("/api/me/", {"phone": ""}, format="json")
        self.assertEqual(cleared.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "")

    def test_logout_deletes_token(self):
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Token.objects.filter(user=self.user).exists())
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

    def test_avatar_upload_rejects_missing_or_invalid_images(self):
        missing = self.client.post("/api/me/avatar/", {}, format="multipart")
        invalid = self.client.post(
            "/api/me/avatar/",
            {"file": SimpleUploadedFile("avatar.png", b"not an image", content_type="image/png")},
            format="multipart",
        )

        self.assertEqual(missing.status_code, 400)
        self.assertIn("file", missing.data)
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("file", invalid.data)

    def test_avatar_upload_and_delete_update_the_user_profile(self):
        output = BytesIO()
        Image.new("RGB", (1024, 600), color="blue").save(output, format="PNG")
        png = output.getvalue()
        with TemporaryDirectory() as media_root:
            with override_settings(
                MEDIA_ROOT=media_root,
                DJANGO_PUBLIC_MEDIA_BASE_URL="https://campushub.test",
            ):
                upload = self.client.post(
                    "/api/me/avatar/",
                    {"file": SimpleUploadedFile("avatar.png", png, content_type="image/png")},
                    format="multipart",
                )
                self.assertEqual(upload.status_code, 200, upload.data)
                self.user.refresh_from_db()
                self.assertTrue(self.user.avatar_url.endswith(upload.data["avatar_url"].split("/")[-1]))
                self.assertTrue(self.user.avatar_url.startswith("https://campushub.test/media/avatars/"))
                member = UserMember.objects.get(user=self.user)
                with Image.open(member.image_path.path) as saved_image:
                    self.assertLessEqual(max(saved_image.size), 512)

                deleted = self.client.delete("/api/me/avatar/")
                self.assertEqual(deleted.status_code, 200)
                self.user.refresh_from_db()
                self.assertEqual(self.user.avatar_url, "")


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
        ClubBoardAssignment.objects.create(user=user, club=own_club)
        other_club.head = UserMember.objects.get(user=user)
        other_club.save(update_fields=["head"])
        request = RequestFactory().get("/")
        request.user = user
        permission = IsClubBoard()

        self.assertEqual(user_club_id(user), own_club.pk)
        self.assertTrue(permission.has_permission(request, None))
        self.assertTrue(permission.has_object_permission(request, None, own_club))
        self.assertFalse(permission.has_object_permission(request, None, other_club))

    def test_ordinary_membership_does_not_grant_board_access(self):
        department = Department.objects.create(title="Technology")
        club = Club.objects.create(name="Robotics", department=department)
        user = User.objects.create_user(
            username="unassigned-board-user",
            password="unused",
            role=User.Role.BOARD_MEMBER,
        )
        UserMember.objects.create(
            user=user,
            username=user.username,
            club_id=club,
        )
        request = RequestFactory().get("/")
        request.user = user
        permission = IsClubBoard()

        self.assertIsNone(user_club_id(user))
        self.assertFalse(permission.has_permission(request, None))
        self.assertFalse(permission.has_object_permission(request, None, club))

    def test_assignment_without_board_role_does_not_grant_access(self):
        department = Department.objects.create(title="Technology")
        club = Club.objects.create(name="Robotics", department=department)
        user = User.objects.create_user(
            username="student-with-stale-assignment",
            password="unused",
        )
        ClubBoardAssignment.objects.create(user=user, club=club)
        request = RequestFactory().get("/")
        request.user = user
        permission = IsClubBoard()

        self.assertIsNone(user_club_id(user))
        self.assertFalse(permission.has_permission(request, None))
        self.assertFalse(permission.has_object_permission(request, None, club))

    def test_club_head_without_board_assignment_cannot_manage_club(self):
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

        self.assertFalse(permission.has_permission(request, None))
        self.assertFalse(permission.has_object_permission(request, None, club))

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

        staff_user = User.objects.create_user(
            username="staff-only",
            password="unused",
            is_staff=True,
        )
        request.user = staff_user
        self.assertFalse(permission.has_permission(request, None))
        self.assertFalse(IsClubBoard().has_permission(request, None))
