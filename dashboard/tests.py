from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core_data.models import Club, Department, UserMember
from .models import Announcement, MembershipRequest


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
        self.assertEqual(
            [row["id"] for row in members.data],
            [self.board_member.pk],
        )
        self.assertEqual(requests.status_code, 200)
        self.assertEqual([row["id"] for row in requests.data], [self.request.pk])
        self.assertEqual(announcements.status_code, 200)
        self.assertEqual(len(announcements.data), 1)

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
