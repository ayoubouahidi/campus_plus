from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import EmailVerification
from core_data.models import Club, Department, UserMember

User = get_user_model()


class SignupSecurityApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(title="Technology")
        self.club = Club.objects.create(name="Robotics", department=self.department)

    def signup_data(self, **overrides):
        data = {
            "password": "strong-campus-password-123",
            "first_name": "Test",
            "last_name": "Student",
            "email": "student@1337.ma",
            "year_of_study": 2,
            "department_id": self.department.pk,
        }
        data.update(overrides)
        return data

    def test_numeric_only_password_is_rejected_by_django_password_validators(self):
        response = self.client.post(
            "/api/signup/",
            self.signup_data(password="12345678"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)
        self.assertFalse(EmailVerification.objects.exists())

    def test_signup_ignores_club_id_and_never_assigns_club(self):
        with patch("core_data.views.secrets.randbelow", return_value=0):
            response = self.client.post(
                "/api/signup/",
                self.signup_data(club_id=self.club.pk),
                format="json",
            )
        self.assertEqual(response.status_code, 202)
        pending = EmailVerification.objects.get(email="student@1337.ma")
        self.assertNotIn("club_id", pending.registration_data)

        verified = self.client.post(
            "/api/signup/verify/",
            {"email": "student@1337.ma", "code": "100000"},
            format="json",
        )
        self.assertEqual(verified.status_code, 201)
        member = UserMember.objects.get(user__email="student@1337.ma")
        self.assertIsNone(member.club_id)

    def test_signup_uses_fifteen_minute_verification_expiry(self):
        with patch("core_data.views.secrets.randbelow", return_value=0):
            response = self.client.post(
                "/api/signup/",
                self.signup_data(),
                format="json",
            )
        self.assertEqual(response.status_code, 202)
        pending = EmailVerification.objects.get(email="student@1337.ma")
        self.assertGreaterEqual(pending.expires_at - pending.created_at, timedelta(minutes=14, seconds=59))
        self.assertLessEqual(pending.expires_at - pending.created_at, timedelta(minutes=15, seconds=1))
