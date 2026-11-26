from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import EmailVerification
from .models import Club, Department, UserMember
from .serializers import SignupSerializer


User = get_user_model()


class SignupEmailSerializerTests(TestCase):
    def test_new_email_is_accepted_case_insensitively(self):
        with patch.object(User.objects, 'filter') as filter_mock:
            filter_mock.return_value.exists.return_value = False

            email = SignupSerializer().validate_email('New.User@example.com')

        self.assertEqual(email, 'new.user@example.com')
        filter_mock.assert_called_once_with(email__iexact='new.user@example.com')

    def test_exact_duplicate_email_has_field_specific_error(self):
        with patch.object(User.objects, 'filter') as filter_mock:
            filter_mock.return_value.exists.return_value = True
            serializer = SignupSerializer(data={'email': 'used@example.com'})

            self.assertFalse(serializer.is_valid())

        self.assertEqual(
            serializer.errors['email'][0],
            'An account with this email already exists.',
        )

    def test_differently_capitalized_duplicate_has_field_specific_error(self):
        with patch.object(User.objects, 'filter') as filter_mock:
            filter_mock.return_value.exists.return_value = True
            serializer = SignupSerializer(data={'email': 'USED@EXAMPLE.COM'})

            self.assertFalse(serializer.is_valid())

        self.assertEqual(
            serializer.errors['email'][0],
            'An account with this email already exists.',
        )
        filter_mock.assert_called_once_with(email__iexact='used@example.com')

    def test_successful_create_preserves_existing_fields_and_password_handling(self):
        department = Department(id=1, title='Technology')
        club = Club(id=2, name='Programming', department=department)
        user = SimpleNamespace(first_name='New', last_name='Student')
        member = SimpleNamespace(user=user)
        validated_data = {
            'password': 'safe-password-123',
            'first_name': 'New',
            'last_name': 'Student',
            'email': 'new@example.com',
            'year_of_study': 2,
            'department_id': department,
            'club_id': club,
        }

        with (
            patch.object(User.objects, 'filter') as filter_mock,
            patch.object(User.objects, 'create_user', return_value=user) as create_user,
            patch.object(
                UserMember.objects,
                'create',
                return_value=member,
            ) as create_member,
        ):
            filter_mock.return_value.exists.return_value = False

            result = SignupSerializer().create(validated_data)

        self.assertIs(result, member)
        create_user.assert_called_once()
        user_values = create_user.call_args.kwargs
        self.assertEqual(user_values['password'], 'safe-password-123')
        self.assertEqual(user_values['email'], 'new@example.com')
        self.assertEqual(user_values['first_name'], 'New')
        self.assertEqual(user_values['last_name'], 'Student')
        create_member.assert_called_once_with(
            user=user,
            username=user_values['username'],
            first_name='New',
            last_name='Student',
            year_of_study=2,
            department_id=department,
            club_id=club,
        )

    def test_successful_signup_sends_code_without_creating_account(self):
        department = Department.objects.create(title='Technology')

        with patch('core_data.views.secrets.randbelow', return_value=0):
            response = APIClient().post(
                '/api/signup/',
                {
                    'password': 'safe-password-123',
                    'first_name': 'New',
                    'last_name': 'Student',
                    'email': 'new@example.com',
                    'year_of_study': 2,
                    'department_id': department.pk,
                },
                format='json',
            )

        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.data['verification_required'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertRegex(mail.outbox[0].body, r'\b100000\b')
        self.assertFalse(User.objects.filter(email='new@example.com').exists())
        self.assertFalse(UserMember.objects.exists())
        pending = EmailVerification.objects.get(email='new@example.com')
        self.assertNotEqual(
            pending.registration_data['password_hash'],
            'safe-password-123',
        )

    def test_existing_club_department_validation_is_preserved(self):
        selected_department = Department(id=1, title='Technology')
        other_department = Department(id=2, title='Design')
        club = Club(id=3, name='Design Club', department=other_department)

        with self.assertRaises(ValidationError) as error:
            SignupSerializer().validate(
                {
                    'department_id': selected_department,
                    'club_id': club,
                }
            )

        self.assertIn('club_id', error.exception.detail)

    def test_existing_password_minimum_length_validation_is_preserved(self):
        serializer = SignupSerializer(data={'password': 'short'})

        self.assertFalse(serializer.is_valid())

        self.assertIn('password', serializer.errors)


class SignupDuplicateEmailDatabaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='registered-user',
            email='Registered@Example.com',
            password='existing-password-123',
        )

    def signup(self, email):
        return self.client.post(
            '/api/signup/',
            {
                'password': 'safe-password-123',
                'first_name': 'New',
                'last_name': 'Student',
                'email': email,
                'year_of_study': 2,
            },
            format='json',
        )

    def assert_duplicate_rejected_without_writes(self, email):
        self.assertFalse(UserMember.objects.filter(user=self.user).exists())
        counts_before = (
            User.objects.count(),
            UserMember.objects.count(),
            Token.objects.count(),
        )

        response = self.signup(email)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['email'][0],
            'An account with this email already exists.',
        )
        self.assertEqual(
            (
                User.objects.count(),
                UserMember.objects.count(),
                Token.objects.count(),
            ),
            counts_before,
        )

    def test_exact_duplicate_for_user_without_member_creates_nothing(self):
        self.assert_duplicate_rejected_without_writes('Registered@Example.com')

    def test_case_variant_duplicate_for_user_without_member_creates_nothing(self):
        self.assert_duplicate_rejected_without_writes('registered@example.COM')


class SignupVerificationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(title='Technology')

    def start_signup(self, *, code=0):
        with patch('core_data.views.secrets.randbelow', return_value=code):
            return self.client.post(
                '/api/signup/',
                {
                    'password': 'safe-password-123',
                    'first_name': 'New',
                    'last_name': 'Student',
                    'email': 'new@example.com',
                    'year_of_study': 2,
                    'department_id': self.department.pk,
                },
                format='json',
            )

    def verify(self, code):
        return self.client.post(
            '/api/signup/verify/',
            {'email': 'NEW@example.com', 'code': code},
            format='json',
        )

    def test_verification_creates_user_member_and_token_once(self):
        self.assertEqual(self.start_signup().status_code, 202)

        response = self.verify('100000')

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='new@example.com')
        self.assertTrue(user.check_password('safe-password-123'))
        self.assertEqual(response.data['token'], Token.objects.get(user=user).key)
        self.assertEqual(UserMember.objects.get(user=user).department_id, self.department)
        self.assertFalse(EmailVerification.objects.filter(email=user.email).exists())
        self.assertEqual(self.verify('100000').status_code, 400)

    def test_verification_rejects_non_six_digit_code_and_locks_after_five_attempts(self):
        self.assertEqual(self.start_signup().status_code, 202)
        pending = EmailVerification.objects.get(email='new@example.com')

        self.assertEqual(self.verify('12345').status_code, 400)
        pending.refresh_from_db()
        self.assertEqual(pending.attempts, 0)

        for _ in range(5):
            self.assertEqual(self.verify('999999').status_code, 400)
        pending.refresh_from_db()
        self.assertEqual(pending.attempts, 5)
        self.assertEqual(self.verify('100000').status_code, 400)
        self.assertFalse(User.objects.filter(email='new@example.com').exists())

    def test_expired_code_cannot_create_account(self):
        self.assertEqual(self.start_signup().status_code, 202)
        pending = EmailVerification.objects.get(email='new@example.com')
        pending.expires_at = timezone.now() - timedelta(seconds=1)
        pending.save(update_fields=['expires_at'])

        response = self.verify('100000')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email='new@example.com').exists())

    def test_resend_invalidates_previous_code_and_sends_a_new_one(self):
        self.assertEqual(self.start_signup(code=0).status_code, 202)
        pending = EmailVerification.objects.get(email='new@example.com')
        EmailVerification.objects.filter(pk=pending.pk).update(
            updated_at=timezone.now() - timedelta(minutes=2)
        )

        with patch('core_data.views.secrets.randbelow', return_value=1):
            response = self.client.post(
                '/api/signup/resend/',
                {'email': 'new@example.com'},
                format='json',
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertRegex(mail.outbox[1].body, r'\b100001\b')
        self.assertEqual(self.verify('100000').status_code, 400)
        self.assertEqual(self.verify('100001').status_code, 201)

    def test_email_delivery_failure_does_not_leave_undelivered_code(self):
        with patch('core_data.views.send_mail', return_value=0):
            response = self.start_signup()

        self.assertEqual(response.status_code, 503)
        self.assertFalse(
            EmailVerification.objects.filter(email='new@example.com').exists()
        )
