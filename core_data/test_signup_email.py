from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import Club, Department, UserMember
from .serializers import SignupSerializer


User = get_user_model()


class SignupEmailSerializerTests(SimpleTestCase):
    def test_new_email_is_accepted_case_insensitively(self):
        with patch.object(User.objects, 'filter') as filter_mock:
            filter_mock.return_value.exists.return_value = False

            email = SignupSerializer().validate_email('New.User@example.com')

        self.assertEqual(email, 'New.User@example.com')
        filter_mock.assert_called_once_with(email__iexact='New.User@example.com')

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
        filter_mock.assert_called_once_with(email__iexact='USED@EXAMPLE.COM')

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

    def test_successful_signup_response_contract_is_preserved(self):
        member = SimpleNamespace(user=SimpleNamespace())
        token = SimpleNamespace(key='test-token')
        member_data = {'id': 5, 'email': 'new@example.com'}

        with (
            patch('core_data.views.SignupSerializer') as serializer_class,
            patch('core_data.views.Token.objects.get_or_create') as get_token,
            patch('core_data.views.UserMemberSerializer') as member_serializer,
        ):
            serializer = serializer_class.return_value
            serializer.save.return_value = member
            get_token.return_value = (token, True)
            member_serializer.return_value.data = member_data

            response = APIClient().post(
                '/api/signup/',
                {'email': 'new@example.com'},
                format='json',
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data,
            {'token': 'test-token', 'member': member_data},
        )
        serializer.is_valid.assert_called_once_with(raise_exception=True)
        serializer.save.assert_called_once_with()

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
