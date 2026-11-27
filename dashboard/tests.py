from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import ClubBoardAssignment
from core_data.models import Club, Department, UserMember
from .models import Announcement, AuditLog, MembershipRequest


User = get_user_model()


class BoardApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        department = Department.objects.create(title="Technology")
        self.club = Club.objects.create(name="Robotics", department=department)
        other_club = Club.objects.create(name="Arts", department=department)
        self.board_user = User.objects.create_user(
            username="board-user",
            password="unused",
            role=User.Role.BOARD_MEMBER,
        )
        self.board_member = UserMember.objects.create(
            user=self.board_user,
            username=self.board_user.username,
            club_id=self.club,
        )
        ClubBoardAssignment.objects.create(
            user=self.board_user,
            club=self.club,
        )
        self.other_user = User.objects.create_user(
            username="other-user",
            password="unused",
        )
        self.other_member = UserMember.objects.create(
            user=self.other_user,
            username=self.other_user.username,
            club_id=other_club,
        )
        self.request = MembershipRequest.objects.create(
            club=self.club,
            member=self.other_member,
            note="Please join",
        )
        token = Token.objects.create(user=self.board_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_board_lists_are_scoped_to_the_board_members_club(self):
        Announcement.objects.create(
            club=self.club,
            title="Welcome",
            message="Welcome to the club.",
        )
        Announcement.objects.create(
            club=self.other_member.club_id,
            title="Private",
            message="Other club announcement.",
        )

        members = self.client.get("/api/board/members/")
        requests = self.client.get("/api/board/requests/")
        announcements = self.client.get("/api/board/announcements/")

        self.assertEqual(members.status_code, 200)
        # Members are the club's board team, not student UserMember rows.
        self.assertEqual(
            [row["id"] for row in members.data],
            [self.board_user.pk],
        )
        self.assertEqual(requests.status_code, 200)
        self.assertEqual([row["id"] for row in requests.data], [self.request.pk])
        self.assertEqual(announcements.status_code, 200)
        self.assertEqual(len(announcements.data), 1)

    def test_board_can_read_and_update_only_supported_club_settings(self):
        response = self.client.get("/api/board/club/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.club.pk)
        self.assertEqual(response.data["department_id"], self.club.department_id)

        updated = self.client.patch(
            "/api/board/club/",
            {"description": "Updated description", "meeting_day": "Friday"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.club.refresh_from_db()
        self.assertEqual(self.club.description, "Updated description")
        self.assertEqual(self.club.meeting_day, "Friday")

        invalid = self.client.patch(
            "/api/board/club/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        self.club.refresh_from_db()
        self.assertTrue(self.club.is_active)

    def test_board_can_approve_own_club_join_request(self):
        response = self.client.post(
            f"/api/board/requests/{self.request.pk}/approve/",
        )

        self.assertEqual(response.status_code, 200)
        self.other_member.refresh_from_db()
        self.assertEqual(self.other_member.club_id, self.club)

    def test_board_cannot_decide_another_clubs_request(self):
        other_request = MembershipRequest.objects.create(
            club=self.other_member.club_id,
            member=self.other_member,
        )

        response = self.client.post(
            f"/api/board/requests/{other_request.pk}/approve/",
        )

        self.assertEqual(response.status_code, 404)
        other_request.refresh_from_db()
        self.assertEqual(other_request.status, MembershipRequest.Status.PENDING)

    def test_anonymous_and_students_cannot_access_board_data(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/board/members/").status_code, 401)

        student_token = Token.objects.create(user=self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {student_token.key}")
        self.assertEqual(self.client.get("/api/board/members/").status_code, 403)

    def test_club_join_endpoint_is_removed(self):
        requests_before = MembershipRequest.objects.count()

        response = self.client.post(
            f"/api/clubs/{self.club.slug}/join/",
            {"note": "Please join"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(MembershipRequest.objects.count(), requests_before)


class SuperadminApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(title="Technology")
        self.club = Club.objects.create(
            name="Robotics",
            department=self.department,
        )
        self.admin = User.objects.create_user(
            username="platform-admin",
            password="unused",
            role=User.Role.SUPERADMIN,
        )
        token = Token.objects.create(user=self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_superadmin_endpoints_reject_students_and_anonymous_users(self):
        self.client.credentials()
        self.assertEqual(
            self.client.get("/api/superadmin/stats/").status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/superadmin/users/",
                {},
                format="json",
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/superadmin/organizations/{self.club.pk}/",
            ).status_code,
            401,
        )

        student = User.objects.create_user(
            username="regular-student",
            password="unused",
        )
        token = Token.objects.create(user=student)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(
            self.client.get("/api/superadmin/stats/").status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/superadmin/organizations/",
                {},
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/superadmin/users/{self.admin.pk}/",
            ).status_code,
            403,
        )

    def test_organization_suspension_is_scoped_and_audited(self):
        organizations = self.client.get("/api/superadmin/organizations/")
        self.assertEqual(organizations.status_code, 200)
        self.assertEqual(organizations.data["count"], 1)

        response = self.client.patch(
            f"/api/superadmin/organizations/{self.club.pk}/",
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.club.refresh_from_db()
        self.assertFalse(self.club.is_active)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action="club_suspended",
                target=self.club.name,
            ).exists()
        )

        invalid_response = self.client.patch(
            f"/api/superadmin/organizations/{self.club.pk}/",
            {"not_supported": True},
            format="json",
        )
        self.assertEqual(invalid_response.status_code, 400)

    def test_superadmin_can_create_update_and_delete_organizations(self):
        created = self.client.post(
            "/api/superadmin/organizations/",
            {
                "name": "New Organization",
                "department": self.department.pk,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        organization_id = created.data["id"]
        self.assertEqual(created.data["department"], self.department.pk)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action="organization_created",
                target="New Organization",
            ).exists()
        )

        updated = self.client.patch(
            f"/api/superadmin/organizations/{organization_id}/",
            {"name": "Updated Organization"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["name"], "Updated Organization")

        deleted = self.client.delete(
            f"/api/superadmin/organizations/{organization_id}/",
        )
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Club.objects.filter(pk=organization_id).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action="organization_deleted",
                target="Updated Organization",
            ).exists()
        )

    def test_organization_cannot_be_deleted_with_board_assignments(self):
        board_user = User.objects.create_user(
            username="assigned-board-member",
            password="unused",
            role=User.Role.BOARD_MEMBER,
        )
        ClubBoardAssignment.objects.create(user=board_user, club=self.club)

        response = self.client.delete(
            f"/api/superadmin/organizations/{self.club.pk}/",
        )

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Club.objects.filter(pk=self.club.pk).exists())
        self.assertTrue(
            ClubBoardAssignment.objects.filter(user=board_user).exists()
        )

    def test_superadmin_stats_reports_platform_totals(self):
        response = self.client.get("/api/superadmin/stats/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_users"], 1)
        self.assertEqual(response.data["total_clubs"], 1)
        self.assertIn("events_this_month", response.data)
        self.assertIn("pending_requests", response.data)

    def test_user_role_change_assigns_club_and_is_audited(self):
        student = User.objects.create_user(
            username="member-to-promote",
            password="unused",
        )
        response = self.client.patch(
            f"/api/superadmin/users/{student.pk}/",
            {
                "role": User.Role.BOARD_MEMBER,
                "club_id": self.club.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        student.refresh_from_db()
        self.assertEqual(student.role, User.Role.BOARD_MEMBER)
        self.assertEqual(student.board_assignment.club, self.club)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action="role_changed",
            ).exists()
        )

    def test_superadmin_can_create_manage_and_delete_users_and_board_assignments(self):
        created = self.client.post(
            "/api/superadmin/users/",
            {
                "username": "new-board-member",
                "email": "new-board@example.com",
                "password": "valid-password-123",
                "role": User.Role.BOARD_MEMBER,
                "club_id": self.club.pk,
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        user_id = created.data["id"]
        board_user = User.objects.get(pk=user_id)
        self.assertTrue(board_user.check_password("valid-password-123"))
        self.assertEqual(board_user.board_assignment.club, self.club)

        updated = self.client.patch(
            f"/api/superadmin/users/{user_id}/",
            {
                "role": User.Role.STUDENT,
                "club_id": None,
                "email": "updated@example.com",
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        board_user.refresh_from_db()
        self.assertEqual(board_user.role, User.Role.STUDENT)
        self.assertEqual(board_user.email, "updated@example.com")
        self.assertFalse(
            ClubBoardAssignment.objects.filter(user=board_user).exists()
        )

        deleted = self.client.delete(f"/api/superadmin/users/{user_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(User.objects.filter(pk=user_id).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action="user_deleted",
                target="new-board-member",
            ).exists()
        )

    def test_superadmin_cannot_delete_own_account(self):
        response = self.client.delete(
            f"/api/superadmin/users/{self.admin.pk}/",
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_last_active_superadmin_cannot_be_demoted_or_disabled(self):
        for payload in (
            {"role": User.Role.STUDENT},
            {"is_active": False},
        ):
            with self.subTest(payload=payload):
                response = self.client.patch(
                    f"/api/superadmin/users/{self.admin.pk}/",
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.admin.refresh_from_db()
                self.assertEqual(self.admin.role, User.Role.SUPERADMIN)
                self.assertTrue(self.admin.is_active)

    def test_board_role_requires_a_club(self):
        student = User.objects.create_user(
            username="unassigned-board-member",
            password="unused",
        )
        UserMember.objects.create(
            user=student,
            username=student.username,
            club_id=self.club,
        )

        for payload in (
            {"role": User.Role.BOARD_MEMBER},
            {"role": User.Role.BOARD_MEMBER, "club_id": None},
        ):
            response = self.client.patch(
                f"/api/superadmin/users/{student.pk}/",
                payload,
                format="json",
            )
            self.assertEqual(response.status_code, 400)

        student.refresh_from_db()
        self.assertEqual(student.role, User.Role.STUDENT)

    def test_demoting_board_member_removes_management_assignment(self):
        board_user = User.objects.create_user(
            username="board-to-demote",
            password="unused",
            role=User.Role.BOARD_MEMBER,
        )
        ClubBoardAssignment.objects.create(user=board_user, club=self.club)

        response = self.client.patch(
            f"/api/superadmin/users/{board_user.pk}/",
            {"role": User.Role.STUDENT},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        board_user.refresh_from_db()
        self.assertEqual(board_user.role, User.Role.STUDENT)
        self.assertFalse(
            ClubBoardAssignment.objects.filter(user=board_user).exists()
        )

    def test_users_search_role_counts_and_audit_pagination(self):
        User.objects.create_user(
            username="searched-board",
            email="board@example.com",
            role=User.Role.BOARD_MEMBER,
        )

        users = self.client.get(
            "/api/superadmin/users/",
            {"role": User.Role.BOARD_MEMBER, "search": "searched"},
        )
        distribution = self.client.get(
            "/api/superadmin/roles/distribution/",
        )
        AuditLog.objects.create(
            actor=self.admin,
            action="test_action",
            target="test target",
        )
        audit_log = self.client.get("/api/superadmin/audit-log/")

        self.assertEqual(users.status_code, 200)
        self.assertEqual(users.data["count"], 1)
        self.assertEqual(users.data["results"][0]["username"], "searched-board")
        self.assertEqual(distribution.status_code, 200)
        self.assertEqual(
            {item["role"]: item["count"] for item in distribution.data},
            {
                User.Role.STUDENT: 0,
                User.Role.BOARD_MEMBER: 1,
                User.Role.SUPERADMIN: 1,
            },
        )
        self.assertEqual(audit_log.status_code, 200)
        self.assertEqual(audit_log.data["results"][0]["action"], "test_action")

    def test_weekly_events_returns_seven_calendar_weeks(self):
        response = self.client.get("/api/superadmin/events/weekly/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 7)
        self.assertTrue(
            all("week_start" in item and "events" in item for item in response.data)
        )
