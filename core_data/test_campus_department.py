"""Campus Hub is 1337 only: nobody chooses a department, Django uses (and creates) the 1337 one."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core_data.models import (
    CAMPUS_DEPARTMENT_SLUG,
    Club,
    Department,
    UserMember,
    campus_department,
)

User = get_user_model()


class CampusDepartmentTests(TestCase):
    def test_a_fresh_database_gets_the_1337_department_once(self):
        self.assertFalse(Department.objects.exists())
        first = campus_department()
        self.assertEqual((first.slug, first.title), (CAMPUS_DEPARTMENT_SLUG, "1337 Coding School"))
        self.assertEqual(campus_department(), first)
        self.assertEqual(Department.objects.count(), 1)

    def test_email_signup_without_a_department_puts_the_student_at_1337(self):
        client = APIClient()
        with patch("core_data.views.secrets.randbelow", return_value=0):
            response = client.post(
                "/api/signup/",
                {
                    "password": "strong-campus-password-123",
                    "first_name": "Test",
                    "last_name": "Student",
                    "email": "new.student@gmail.com",
                    "year_of_study": 1,
                },
                format="json",
            )
        self.assertEqual(response.status_code, 202, response.data)
        verified = client.post(
            "/api/signup/verify/",
            {"email": "new.student@gmail.com", "code": "100000"},
            format="json",
        )
        self.assertEqual(verified.status_code, 201, verified.data)
        member = UserMember.objects.get(user__email="new.student@gmail.com")
        self.assertEqual(member.department_id, campus_department())

    def test_super_admin_creates_an_organization_without_a_department(self):
        admin = User.objects.create_user(username="admin", password="unused", role=User.Role.SUPERADMIN)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=admin).key}")
        response = client.post(
            "/api/superadmin/organizations/",
            {"name": "Pixels", "category": "Gaming", "is_active": True},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["department_name"], "1337 Coding School")
        self.assertEqual(Club.objects.get(name="Pixels").department, campus_department())

    def test_members_created_anywhere_are_at_1337(self):
        user = User.objects.create_user(username="fortytwo", password="unused")
        member = UserMember.objects.create(user=user, username="fortytwo")
        self.assertEqual(member.department_id, campus_department())
