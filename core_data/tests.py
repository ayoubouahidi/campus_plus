from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from .models import Club, ClubEvent, Department, UserMember, validate_file_size, validate_image_content


class ImageValidationTests(TestCase):
	def test_file_size_limit_is_strictly_under_two_megabytes(self):
		upload = SimpleUploadedFile('avatar.png', b'x' * (2 * 1024 * 1024), content_type='image/png')

		with self.assertRaises(ValidationError):
			validate_file_size(upload)

	def test_image_mime_type_must_match_decoded_content(self):
		image_buffer = BytesIO()
		Image.new('RGB', (1, 1)).save(image_buffer, format='PNG')
		upload = SimpleUploadedFile(
			'avatar.png',
			image_buffer.getvalue(),
			content_type='image/jpeg',
		)

		with self.assertRaises(ValidationError):
			validate_image_content(upload)


class ClubEventFilterTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.department = Department.objects.create(title='Technology')
		self.other_department = Department.objects.create(title='Arts')
		ClubEvent.objects.create(
			name='Tech Summit',
			description='Engineering talks',
			parent_id=self.department,
		)
		ClubEvent.objects.create(
			name='Gallery Night',
			description='Technology photography',
			parent_id=self.other_department,
		)

	def test_department_and_category_filters_are_combined(self):
		response = self.client.get(
			'/api/club-events/',
			{'department': self.department.pk, 'category': 'summit'},
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['name'], 'Tech Summit')


class DepartmentAndMemberApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(title='Technology')

    def test_department_can_be_created_and_listed(self):
        create_response = self.client.post(
            '/api/departments/',
            {'title': 'Arts'},
            format='json',
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data['title'], 'Arts')
        self.assertEqual(Department.objects.count(), 2)

    def test_member_can_be_created_with_department(self):
        admin = User.objects.create_superuser(
            username='member-admin',
            password='admin-password-123',
        )
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            '/api/members/',
            {
                'username': 'alice',
                'department_id': self.department.pk,
                'role': 'President',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['username'], 'alice')
        self.assertEqual(response.data['department_id'], self.department.pk)
        self.assertEqual(UserMember.objects.get(username='alice').department_id, self.department)

    def test_members_cannot_be_read_anonymously(self):
        response = self.client.get('/api/members/')

        self.assertEqual(response.status_code, 401)

    def test_signup_assigns_department_and_club_without_approval(self):
        club = Club.objects.create(name='Programming', department=self.department)

        response = self.client.post(
            '/api/signup/',
            {
                'password': 'safe-password-123',
                'first_name': 'New',
                'last_name': 'User',
                'email': 'new-user@example.com',
                'year_of_study': 2,
                'department_id': self.department.pk,
                'club_id': club.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        member = UserMember.objects.get(user__email='new-user@example.com')
        self.assertTrue(member.username.startswith('user_'))
        self.assertEqual(member.year_of_study, 2)
        self.assertEqual(member.user.email, 'new-user@example.com')
        self.assertEqual(member.club_id, club)
        self.assertTrue(member.user.check_password('safe-password-123'))
        self.assertIn('token', response.data)

    def test_signup_generates_unique_username_without_club(self):
        payload = {
            'password': 'safe-password-123',
            'first_name': 'New',
            'last_name': 'User',
            'email': 'first@example.com',
            'year_of_study': 1,
            'department_id': self.department.pk,
        }
        first_response = self.client.post('/api/signup/', payload, format='json')
        payload['email'] = 'second@example.com'
        second_response = self.client.post('/api/signup/', payload, format='json')

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        self.assertNotEqual(
            first_response.data['member']['username'],
            second_response.data['member']['username'],
        )

    def test_admin_can_create_club_with_president_and_metadata(self):
        admin = User.objects.create_superuser(
            username='admin',
            password='admin-password-123',
        )
        president = UserMember.objects.create(
            username='president',
            department_id=self.department,
        )
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            '/api/clubs/',
            {
                'name': 'Programming',
                'description': 'Builds useful software.',
                'department': self.department.pk,
                'president': president.pk,
                'contact_email': 'programming@example.com',
                'meeting_day': 'Wednesday',
                'meeting_location': 'Room 101',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['president'], president.pk)
        self.assertEqual(response.data['member_count'], 0)
        self.assertEqual(response.data['event_count'], 0)
        self.assertEqual(Club.objects.get(name='Programming').head, president)

    def test_club_event_can_store_schedule_and_club(self):
        head_user = User.objects.create_user(
            username='event-head',
            password='head-password-123',
        )
        head = UserMember.objects.create(
            username='event-head',
            user=head_user,
            department_id=self.department,
        )
        club = Club.objects.create(
            name='Programming',
            department=self.department,
            head=head,
        )
        self.client.force_authenticate(user=head_user)

        response = self.client.post(
            '/api/club-events/',
            {
                'name': 'Demo Day',
                'description': 'Project demonstrations.',
                'parent_id': self.department.pk,
                'club': club.pk,
                'starts_at': '2026-11-01T10:00:00Z',
                'ends_at': '2026-11-01T12:00:00Z',
                'location': 'Auditorium',
                'status': 'planned',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['club'], club.pk)
        self.assertEqual(response.data['status'], 'planned')

    def test_non_head_cannot_create_club_event(self):
        head_user = User.objects.create_user(
            username='real-head',
            password='head-password-123',
        )
        head = UserMember.objects.create(
            username='real-head',
            user=head_user,
            department_id=self.department,
        )
        club = Club.objects.create(
            name='Programming',
            department=self.department,
            head=head,
        )
        other_user = User.objects.create_user(
            username='not-head',
            password='user-password-123',
        )
        self.client.force_authenticate(user=other_user)

        response = self.client.post(
            '/api/club-events/',
            {
                'name': 'Unauthorized Event',
                'parent_id': self.department.pk,
                'club': club.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)
