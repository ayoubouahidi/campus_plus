from datetime import datetime, time, timezone
from io import BytesIO
import os
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from PIL import Image
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

from accounts.models import ClubBoardAssignment
from .models import (
    MAX_IMAGE_DIMENSION,
    MAX_IMAGE_SIZE,
    Club,
    ClubEvent,
    Department,
    UserMember,
    uuid_path,
    validate_file_size,
    validate_image_content,
)
from .serializers import ClubEventSerializer, ClubSerializer, DepartmentSerializer
from .views import (
    CanCreateClubEvent,
    CanModifyClubEvent,
    ClubViewSet,
    ClubEventFilterBackend,
    ClubEventPagination,
    ClubEventViewSet,
    DepartmentViewSet,
    UserMemberViewSet,
)


User = get_user_model()


class ClubEventPublicReadSerializerTests(SimpleTestCase):
    def setUp(self):
        self.department = Department(
            id=1,
            title='1337 Coding School',
            slug='1337',
        )
        self.club = Club(
            id=2,
            name='LEET Dev',
            slug='leet-dev',
            department=self.department,
        )
        self.event = ClubEvent(
            id=3,
            name='AI Hackathon',
            description='Build an edge AI project.',
            parent_id=self.department,
            club=self.club,
            image_path='',
            location='Agora Hall',
            category='Tech',
            capacity=150,
            starts_at=datetime(2026, 11, 21, 9, tzinfo=timezone.utc),
            ends_at=datetime(2026, 11, 23, 9, tzinfo=timezone.utc),
            status='planned',
        )

    def test_public_read_contract_adds_frontend_names(self):
        data = ClubEventSerializer(self.event).data

        self.assertEqual(data['id'], 3)
        self.assertEqual(data['title'], 'AI Hackathon')
        self.assertEqual(data['club_id'], 2)
        self.assertEqual(data['club_name'], 'LEET Dev')
        self.assertEqual(data['club_slug'], 'leet-dev')
        self.assertEqual(data['department_name'], '1337 Coding School')
        self.assertEqual(data['department_slug'], '1337')
        self.assertEqual(data['flyer_url'], '')
        self.assertEqual(data['category'], 'Tech')
        self.assertEqual(data['capacity'], 150)
        self.assertEqual(data['start_time'], '2026-11-21T09:00:00Z')
        self.assertEqual(data['end_time'], '2026-11-23T09:00:00Z')

    def test_existing_event_fields_are_preserved(self):
        data = ClubEventSerializer(self.event).data

        self.assertEqual(data['name'], 'AI Hackathon')
        self.assertEqual(data['parent_id'], 1)
        self.assertEqual(data['club'], 2)
        self.assertEqual(data['parent'], '1337 Coding School')
        self.assertEqual(data['starts_at'], '2026-11-21T09:00:00Z')
        self.assertEqual(data['ends_at'], '2026-11-23T09:00:00Z')
        self.assertEqual(data['status'], 'planned')

    @override_settings(PUBLIC_MEDIA_BASE_URL='')
    def test_flyer_url_is_absolute_when_request_is_available(self):
        self.event.image_path = 'events_pics/flyer.webp'
        request = APIRequestFactory().get('/api/club-events/3/')

        data = ClubEventSerializer(
            self.event,
            context={'request': request},
        ).data

        self.assertEqual(
            data['flyer_url'],
            'http://testserver/media/events_pics/flyer.webp',
        )

    def test_rsvp_fields_have_safe_anonymous_defaults(self):
        data = ClubEventSerializer(self.event).data

        self.assertEqual(data['rsvps_count'], 0)
        self.assertFalse(data['has_user_rsvpd'])
        self.assertEqual(data['attendees_preview'], [])

    def test_nullable_legacy_values_are_not_replaced_with_invented_data(self):
        event = ClubEvent(
            id=4,
            name='Schedule Pending',
            parent_id=self.department,
        )

        data = ClubEventSerializer(event).data

        self.assertIsNone(data['club_id'])
        self.assertIsNone(data['club_name'])
        self.assertIsNone(data['club_slug'])
        self.assertIsNone(data['category'])
        self.assertIsNone(data['capacity'])
        self.assertIsNone(data['start_time'])
        self.assertIsNone(data['end_time'])


class ClubEventOwnershipSecurityTests(SimpleTestCase):
    def setUp(self):
        self.department = Department(id=1, title='Technology')
        self.other_department = Department(id=2, title='Arts')
        self.head_user = User(
            id=10,
            username='head',
            role=User.Role.BOARD_MEMBER,
        )
        self.student = User(id=11, username='student')
        self.staff = User(
            id=12,
            username='superadmin',
            role=User.Role.SUPERADMIN,
        )
        self.head = UserMember(id=20, username='head', user=self.head_user)
        self.other_head = UserMember(id=21, username='other-head')
        self.club = Club(
            id=30,
            name='Programming',
            department=self.department,
            head=self.head,
        )
        self.other_club = Club(
            id=31,
            name='Robotics',
            department=self.other_department,
            head=self.other_head,
        )
        self.event = ClubEvent(
            id=40,
            name='Demo Day',
            parent_id=self.department,
            club=self.club,
            location='Room 1',
        )

    @staticmethod
    def request_for(user):
        return SimpleNamespace(user=user)

    def validate_update(self, user, attrs):
        serializer = ClubEventSerializer(
            instance=self.event,
            context={'request': self.request_for(user)},
        )
        return serializer.validate(attrs)

    def test_anonymous_event_modification_is_denied(self):
        permission = CanModifyClubEvent()

        self.assertFalse(permission.has_permission(
            self.request_for(AnonymousUser()),
            ClubEventViewSet(),
        ))

    @patch('core_data.views.ClubBoardAssignment.objects.filter')
    def test_ordinary_student_event_modification_is_denied(self, club_filter):
        club_filter.return_value.exists.return_value = False
        permission = CanModifyClubEvent()
        request = self.request_for(self.student)

        self.assertTrue(permission.has_permission(request, ClubEventViewSet()))
        self.assertFalse(permission.has_object_permission(
            request,
            ClubEventViewSet(),
            self.event,
        ))

    @patch('core_data.views.ClubBoardAssignment.objects.filter')
    def test_club_head_can_update_an_ordinary_field(self, club_filter):
        club_filter.return_value.exists.return_value = True
        permission = CanModifyClubEvent()
        request = self.request_for(self.head_user)
        update_data = {
            'name': 'Updated Demo Day',
            'description': 'Updated description',
            'starts_at': '2026-11-21T10:00:00Z',
            'ends_at': '2026-11-21T12:00:00Z',
            'location': 'Main Hall',
            'status': 'ongoing',
        }

        self.assertTrue(permission.has_object_permission(
            request,
            ClubEventViewSet(),
            self.event,
        ))
        serializer = ClubEventSerializer(
            instance=self.event,
            data=update_data,
            partial=True,
            context={'request': request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['name'], 'Updated Demo Day')
        self.assertEqual(serializer.validated_data['location'], 'Main Hall')
        self.assertEqual(serializer.validated_data['status'], 'ongoing')

    @patch('core_data.views.ClubBoardAssignment.objects.filter')
    def test_club_head_cannot_modify_another_clubs_event(self, club_filter):
        club_filter.return_value.exists.return_value = False
        other_event = ClubEvent(
            id=41,
            name='Other Event',
            parent_id=self.other_department,
            club=self.other_club,
        )

        self.assertFalse(CanModifyClubEvent().has_object_permission(
            self.request_for(self.head_user),
            ClubEventViewSet(),
            other_event,
        ))

    def test_club_head_cannot_transfer_event_to_another_club(self):
        with self.assertRaises(DRFValidationError) as context:
            self.validate_update(self.head_user, {'club': self.other_club})

        self.assertIn('club', context.exception.detail)

    def test_club_head_cannot_remove_event_club(self):
        with self.assertRaises(DRFValidationError) as context:
            self.validate_update(self.head_user, {'club': None})

        self.assertIn('club', context.exception.detail)

    def test_club_head_cannot_change_event_department(self):
        with self.assertRaises(DRFValidationError) as context:
            self.validate_update(
                self.head_user,
                {'parent_id': self.other_department},
            )

        self.assertIn('parent_id', context.exception.detail)

    def test_unchanged_relationship_values_are_allowed(self):
        same_club = Club(id=self.club.pk, department=self.department)
        same_department = Department(id=self.department.pk)

        self.assertEqual(
            self.validate_update(self.head_user, {
                'club': same_club,
                'parent_id': same_department,
            }),
            {'club': same_club, 'parent_id': same_department},
        )

    def test_rejected_transfer_is_not_saved_or_broadcast(self):
        serializer = ClubEventSerializer(
            instance=self.event,
            data={'club': self.other_club.pk},
            partial=True,
            context={'request': self.request_for(self.head_user)},
        )
        serializer.fields['club'].queryset = Mock()
        serializer.fields['club'].queryset.get.return_value = self.other_club
        view = ClubEventViewSet()
        view.get_object = Mock(return_value=self.event)
        view.get_serializer = Mock(return_value=serializer)
        view.perform_update = Mock()

        with patch('core_data.views.broadcast_calendar_event') as broadcast:
            with self.assertRaises(DRFValidationError):
                view.partial_update(SimpleNamespace(data={
                    'club': self.other_club.pk,
                }))

        view.perform_update.assert_not_called()
        broadcast.assert_not_called()
        self.assertEqual(self.event.club_id, self.club.pk)

    def test_superadmin_permissions_and_relationship_updates_remain_allowed(self):
        permission = CanModifyClubEvent()
        request = self.request_for(self.staff)

        self.assertTrue(permission.has_permission(request, ClubEventViewSet()))
        self.assertTrue(permission.has_object_permission(
            request,
            ClubEventViewSet(),
            self.event,
        ))
        self.assertEqual(
            self.validate_update(self.staff, {
                'club': self.other_club,
                'parent_id': self.other_department,
            }),
            {
                'club': self.other_club,
                'parent_id': self.other_department,
            },
        )


class ClubEventRelationshipIntegrityTests(SimpleTestCase):
    def setUp(self):
        self.department = Department(id=101, title='Technology')
        self.other_department = Department(id=102, title='Arts')
        self.head_user = User(
            id=110,
            username='head',
            role=User.Role.BOARD_MEMBER,
        )
        self.staff = User(
            id=111,
            username='superadmin',
            role=User.Role.SUPERADMIN,
        )
        self.head = UserMember(
            id=120,
            username='head',
            user=self.head_user,
        )
        self.club = Club(
            id=130,
            name='Programming',
            department=self.department,
            head=self.head,
        )
        self.other_club = Club(
            id=131,
            name='Robotics',
            department=self.other_department,
        )
        self.event = ClubEvent(
            id=140,
            name='Demo Day',
            parent_id=self.department,
            club=self.club,
            location='Room 1',
        )

    @staticmethod
    def request_for(user, data=None):
        return SimpleNamespace(user=user, data=data or {})

    def validate(self, attrs, user=None, instance=None):
        serializer = ClubEventSerializer(
            instance=instance,
            context={'request': self.request_for(user or self.staff)},
        )
        return serializer.validate(attrs)

    @patch('core_data.views.ClubBoardAssignment.objects.filter')
    def test_club_head_creates_for_own_club_and_department(self, club_filter):
        club_filter.return_value.exists.return_value = True
        request = self.request_for(self.head_user, {'club': self.club.pk})
        attrs = {
            'name': 'Valid Event',
            'category': 'Tech',
            'club': self.club,
            'parent_id': self.department,
            'starts_at': datetime(2026, 11, 21, 10, tzinfo=timezone.utc),
            'ends_at': datetime(2026, 11, 21, 12, tzinfo=timezone.utc),
        }

        self.assertTrue(CanCreateClubEvent().has_permission(
            request,
            ClubEventViewSet(),
        ))
        self.assertEqual(self.validate(attrs, self.head_user), attrs)

    def test_club_head_cannot_create_with_mismatched_department(self):
        with self.assertRaises(DRFValidationError) as context:
            self.validate({
                'name': 'Invalid Event',
                'category': 'Tech',
                'club': self.club,
                'parent_id': self.other_department,
                'starts_at': datetime(2026, 11, 21, 10, tzinfo=timezone.utc),
                'ends_at': datetime(2026, 11, 21, 12, tzinfo=timezone.utc),
            }, self.head_user)

        self.assertIn('parent_id', context.exception.detail)

    @patch('core_data.views.ClubBoardAssignment.objects.filter')
    def test_club_head_cannot_create_for_another_club(self, club_filter):
        club_filter.return_value.exists.return_value = False
        request = self.request_for(self.head_user, {
            'club': self.other_club.pk,
        })

        self.assertFalse(CanCreateClubEvent().has_permission(
            request,
            ClubEventViewSet(),
        ))

    def test_staff_can_create_with_consistent_relationships(self):
        request = self.request_for(self.staff, {'club': self.club.pk})
        attrs = {
            'name': 'Staff Event',
            'category': 'Tech',
            'club': self.club,
            'parent_id': self.department,
            'starts_at': datetime(2026, 11, 21, 10, tzinfo=timezone.utc),
            'ends_at': datetime(2026, 11, 21, 12, tzinfo=timezone.utc),
        }

        self.assertTrue(CanCreateClubEvent().has_permission(
            request,
            ClubEventViewSet(),
        ))
        self.assertEqual(self.validate(attrs), attrs)

    def test_staff_cannot_create_with_mismatched_relationships(self):
        with self.assertRaises(DRFValidationError) as context:
            self.validate({
                'name': 'Invalid Staff Event',
                'category': 'Tech',
                'club': self.club,
                'parent_id': self.other_department,
                'starts_at': datetime(2026, 11, 21, 10, tzinfo=timezone.utc),
                'ends_at': datetime(2026, 11, 21, 12, tzinfo=timezone.utc),
            })

        self.assertIn('parent_id', context.exception.detail)

    def test_staff_cannot_transfer_event_into_inconsistent_relationships(self):
        with self.assertRaises(DRFValidationError) as context:
            self.validate(
                {'club': self.other_club},
                instance=self.event,
            )

        self.assertIn('parent_id', context.exception.detail)

    def test_valid_staff_relationship_transfer_is_allowed(self):
        attrs = {
            'club': self.other_club,
            'parent_id': self.other_department,
        }

        self.assertEqual(
            self.validate(attrs, instance=self.event),
            attrs,
        )

    def test_staff_department_only_event_remains_allowed(self):
        request = self.request_for(self.staff)
        attrs = {
            'name': 'Department Event',
            'category': 'Tech',
            'parent_id': self.department,
            'starts_at': datetime(2026, 11, 21, 10, tzinfo=timezone.utc),
            'ends_at': datetime(2026, 11, 21, 12, tzinfo=timezone.utc),
        }

        self.assertTrue(CanCreateClubEvent().has_permission(
            request,
            ClubEventViewSet(),
        ))
        self.assertEqual(self.validate(attrs), attrs)

    def test_ordinary_event_edit_remains_allowed(self):
        attrs = {'description': 'Updated description'}

        self.assertEqual(
            self.validate(attrs, self.head_user, self.event),
            attrs,
        )

    def test_invalid_create_is_not_saved_or_broadcast(self):
        serializer = ClubEventSerializer(
            data={
                'name': 'Invalid Event',
                'category': 'Tech',
                'club': self.club.pk,
                'parent_id': self.other_department.pk,
                'starts_at': '2026-11-21T10:00:00Z',
                'ends_at': '2026-11-21T12:00:00Z',
            },
            context={'request': self.request_for(self.staff)},
        )
        serializer.fields['club'].queryset = Mock()
        serializer.fields['club'].queryset.get.return_value = self.club
        serializer.fields['parent_id'].queryset = Mock()
        serializer.fields['parent_id'].queryset.get.return_value = (
            self.other_department
        )
        view = ClubEventViewSet()
        view.get_serializer = Mock(return_value=serializer)
        view.perform_create = Mock()

        with patch('core_data.views.broadcast_calendar_event') as broadcast:
            with self.assertRaises(DRFValidationError):
                view.create(SimpleNamespace(data=serializer.initial_data))

        view.perform_create.assert_not_called()
        broadcast.assert_not_called()


class ClubEventManagementValidationTests(SimpleTestCase):
    def setUp(self):
        self.department = Department(id=201, title='Technology')
        self.staff = User(
            id=210,
            username='superadmin',
            role=User.Role.SUPERADMIN,
        )
        self.head_user = User(
            id=211,
            username='head',
            role=User.Role.BOARD_MEMBER,
        )
        self.head = UserMember(
            id=220,
            username='head',
            user=self.head_user,
        )
        self.club = Club(
            id=230,
            name='Programming',
            department=self.department,
            head=self.head,
        )
        self.event = ClubEvent(
            id=240,
            name='Demo Day',
            category='Tech',
            parent_id=self.department,
            club=self.club,
            starts_at=datetime(2026, 11, 21, 10, tzinfo=timezone.utc),
            ends_at=datetime(2026, 11, 21, 12, tzinfo=timezone.utc),
            capacity=100,
        )
        self.valid_create_data = {
            'name': 'New Event',
            'category': 'Tech',
            'parent_id': self.department.pk,
            'club': self.club.pk,
            'starts_at': '2026-11-22T10:00:00Z',
            'ends_at': '2026-11-22T12:00:00Z',
        }

    def make_serializer(self, data, instance=None, user=None, partial=False):
        request = SimpleNamespace(user=user or self.staff)
        serializer = ClubEventSerializer(
            instance=instance,
            data=data,
            partial=partial,
            context={'request': request},
        )
        serializer.fields['parent_id'].queryset = Mock()
        serializer.fields['parent_id'].queryset.get.return_value = self.department
        serializer.fields['club'].queryset = Mock()
        serializer.fields['club'].queryset.get.return_value = self.club
        return serializer

    def test_creation_requires_name_category_dates_and_department(self):
        for field_name in (
            'name',
            'category',
            'starts_at',
            'ends_at',
            'parent_id',
        ):
            with self.subTest(field=field_name):
                data = dict(self.valid_create_data)
                data.pop(field_name)
                serializer = self.make_serializer(data)

                self.assertFalse(serializer.is_valid())
                self.assertIn(field_name, serializer.errors)

        data = dict(self.valid_create_data, name='   ')
        serializer = self.make_serializer(data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('name', serializer.errors)

    def test_invalid_category_choice_is_rejected(self):
        data = dict(self.valid_create_data, category='Unknown')
        serializer = self.make_serializer(data)

        self.assertFalse(serializer.is_valid())
        self.assertIn('category', serializer.errors)

    def test_each_documented_category_is_valid(self):
        for category, _ in ClubEvent.CATEGORY_CHOICES:
            with self.subTest(category=category):
                data = dict(self.valid_create_data, category=category)
                serializer = self.make_serializer(data)

                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertEqual(serializer.validated_data['category'], category)

    def test_invalid_datetime_values_are_rejected(self):
        for field_name in ('starts_at', 'ends_at'):
            with self.subTest(field=field_name):
                data = dict(self.valid_create_data)
                data[field_name] = 'not-a-datetime'
                serializer = self.make_serializer(data)

                self.assertFalse(serializer.is_valid())
                self.assertIn(field_name, serializer.errors)

    def test_end_must_be_strictly_later_than_start(self):
        invalid_end_values = (
            '2026-11-22T09:00:00Z',
            '2026-11-22T10:00:00Z',
        )
        for end_value in invalid_end_values:
            with self.subTest(end=end_value):
                data = dict(self.valid_create_data, ends_at=end_value)
                serializer = self.make_serializer(data)

                self.assertFalse(serializer.is_valid())
                self.assertIn('ends_at', serializer.errors)

    def test_valid_chronological_dates_are_accepted(self):
        serializer = self.make_serializer(self.valid_create_data)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertLess(
            serializer.validated_data['starts_at'],
            serializer.validated_data['ends_at'],
        )

    def test_valid_and_invalid_capacity_values(self):
        for capacity in (0, 25, None):
            with self.subTest(valid_capacity=capacity):
                data = dict(self.valid_create_data, capacity=capacity)
                serializer = self.make_serializer(data)
                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertEqual(serializer.validated_data['capacity'], capacity)

        for capacity in (-1, 'not-an-integer', 1.5):
            with self.subTest(invalid_capacity=capacity):
                data = dict(self.valid_create_data, capacity=capacity)
                serializer = self.make_serializer(data)
                self.assertFalse(serializer.is_valid())
                self.assertIn('capacity', serializer.errors)

    def test_authorized_partial_update_uses_effective_dates(self):
        valid_serializer = self.make_serializer(
            {
                'description': 'Updated',
                'category': 'Music',
                'capacity': 0,
                'ends_at': '2026-11-21T13:00:00Z',
            },
            instance=self.event,
            user=self.head_user,
            partial=True,
        )
        self.assertTrue(valid_serializer.is_valid(), valid_serializer.errors)
        self.assertEqual(valid_serializer.validated_data['category'], 'Music')
        self.assertEqual(valid_serializer.validated_data['capacity'], 0)

        invalid_serializer = self.make_serializer(
            {'starts_at': '2026-11-21T12:00:00Z'},
            instance=self.event,
            user=self.head_user,
            partial=True,
        )
        self.assertFalse(invalid_serializer.is_valid())
        self.assertIn('ends_at', invalid_serializer.errors)

    def test_ordinary_edit_preserves_nullable_legacy_event(self):
        legacy_event = ClubEvent(
            id=241,
            name='Legacy Event',
            parent_id=self.department,
            club=self.club,
            category=None,
            starts_at=None,
            ends_at=None,
        )
        serializer = self.make_serializer(
            {'description': 'Ordinary edit'},
            instance=legacy_event,
            user=self.head_user,
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_create_is_not_saved_or_broadcast(self):
        data = dict(
            self.valid_create_data,
            ends_at='2026-11-22T10:00:00Z',
        )
        serializer = self.make_serializer(data)
        view = ClubEventViewSet()
        view.get_serializer = Mock(return_value=serializer)
        view.perform_create = Mock()

        with patch('core_data.views.broadcast_calendar_event') as broadcast:
            with self.assertRaises(DRFValidationError):
                view.create(SimpleNamespace(data=data))

        view.perform_create.assert_not_called()
        broadcast.assert_not_called()


class PublicClubSerializerTests(SimpleTestCase):
    def setUp(self):
        self.department = Department(
            id=10,
            title='1337 Coding School',
            slug='1337',
        )
        self.president = UserMember(
            id=20,
            username='president',
            first_name='Yassine',
            last_name='El Amrani',
            phone='+212600000000',
        )
        self.club = Club(
            id=30,
            slug='leet-dev',
            name='LEET Dev',
            description='A software engineering club.',
            department=self.department,
            head=self.president,
            logo='club_logos/logo.webp',
            banner='club_banners/banner.webp',
            contact_email='private@example.com',
            meeting_day='Thursday',
            meeting_time=time(17, 0),
            meeting_location='Innovation lab',
            is_active=True,
        )
        self.club.member_count = 86
        self.club.event_count = 24
        self.club.upcoming_event_count = 3

    @override_settings(PUBLIC_MEDIA_BASE_URL='')
    def test_public_contract_includes_documented_club_fields(self):
        request = APIRequestFactory().get('/api/clubs/leet-dev/')

        data = ClubSerializer(
            self.club,
            context={'request': request},
        ).data

        self.assertEqual(data['id'], 30)
        self.assertEqual(data['slug'], 'leet-dev')
        self.assertEqual(data['department_id'], 10)
        self.assertEqual(data['department_name'], '1337 Coding School')
        self.assertEqual(data['department_slug'], '1337')
        self.assertEqual(data['president_name'], 'Yassine El Amrani')
        self.assertEqual(data['member_count'], 86)
        self.assertEqual(data['event_count'], 24)
        self.assertEqual(data['upcoming_event_count'], 3)
        self.assertEqual(data['meeting_time'], '17:00:00')
        self.assertEqual(
            data['logo_url'],
            'http://testserver/media/club_logos/logo.webp',
        )
        self.assertEqual(
            data['banner_url'],
            'http://testserver/media/club_banners/banner.webp',
        )

    def test_private_contact_values_are_not_in_public_output(self):
        data = ClubSerializer(self.club).data

        self.assertNotIn('contact_email', data)
        self.assertNotIn('president_email', data)
        self.assertNotIn('president_phone', data)
        self.assertNotIn('phone', data)

    def test_nullable_public_values_have_documented_empty_shapes(self):
        club = Club(
            id=31,
            slug=None,
            name='New Club',
            department=self.department,
            head=None,
            logo='',
            banner='',
        )
        club.member_count = 0
        club.event_count = 0
        club.upcoming_event_count = 0

        data = ClubSerializer(club).data

        self.assertIsNone(data['slug'])
        self.assertEqual(data['logo_url'], '')
        self.assertIsNone(data['banner_url'])
        self.assertEqual(data['president_name'], '')

    def test_legacy_relationship_fields_and_contact_write_input_remain(self):
        data = ClubSerializer(self.club).data
        serializer = ClubSerializer()

        self.assertEqual(data['department'], 10)
        self.assertEqual(data['president'], 20)
        self.assertTrue(serializer.fields['contact_email'].write_only)


class PublicDepartmentSerializerTests(SimpleTestCase):
    def test_frontend_name_slug_and_legacy_title_are_published(self):
        department = Department(
            id=10,
            title='1337 Coding School',
            slug='1337',
        )

        data = DepartmentSerializer(department).data

        self.assertEqual(data, {
            'id': 10,
            'name': '1337 Coding School',
            'title': '1337 Coding School',
            'slug': '1337',
        })


class PublicClubQueryTests(SimpleTestCase):
    @patch('core_data.views.timezone.now')
    def test_public_list_is_active_joined_and_counted_in_one_query(self, now):
        now.return_value = datetime(
            2026,
            11,
            20,
            12,
            tzinfo=timezone.utc,
        )
        view = ClubViewSet()
        view.action = 'list'

        queryset = view.get_queryset()
        sql, params = queryset.query.sql_with_params()

        self.assertIn('is_active', str(queryset.query.where))
        self.assertIn('core_data_department', sql)
        self.assertIn('core_data_usermember', sql)
        self.assertIn('member_count', queryset.query.annotations)
        self.assertIn('event_count', queryset.query.annotations)
        self.assertIn('upcoming_event_count', queryset.query.annotations)
        self.assertTrue(any('2026-11-20' in str(value) for value in params))

    def test_detail_uses_slug_and_write_query_behavior_is_unchanged(self):
        self.assertEqual(ClubViewSet.lookup_field, 'slug')

        view = ClubViewSet()
        view.action = 'create'
        queryset = view.get_queryset()

        self.assertFalse(queryset.query.where.children)
        self.assertFalse(queryset.query.annotations)


class TemporaryClubAndDepartmentWriteProtectionTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.ordinary_user = User(id=100, username='student')
        self.staff_user = User(
            id=101,
            username='temporary-admin',
            is_staff=True,
            is_superuser=True,
        )

    def assert_all_writes_are_method_not_allowed(self, collection_url, detail_url):
        callers = (None, self.ordinary_user, self.staff_user)
        operations = (
            ('post', collection_url, {'name': 'Unsafe write'}),
            ('put', detail_url, {'name': 'Unsafe write'}),
            ('patch', detail_url, {'name': 'Unsafe write'}),
            ('delete', detail_url, None),
        )

        for caller in callers:
            client = APIClient()
            if caller is not None:
                client.force_authenticate(user=caller)
            for method, url, data in operations:
                with self.subTest(caller=caller, method=method, url=url):
                    request = getattr(client, method)
                    if data is None:
                        response = request(url)
                    else:
                        response = request(url, data, format='json')
                    self.assertEqual(response.status_code, 405)
                    self.assertEqual(
                        set(response.headers['Allow'].split(', ')),
                        {'GET', 'HEAD', 'OPTIONS'},
                    )

    def test_club_writes_are_disabled_for_every_caller(self):
        self.assert_all_writes_are_method_not_allowed(
            '/api/clubs/',
            '/api/clubs/leet-dev/',
        )

    def test_department_writes_are_disabled_for_every_caller(self):
        self.assert_all_writes_are_method_not_allowed(
            '/api/departments/',
            '/api/departments/1/',
        )

    @patch.object(ClubViewSet, 'get_queryset')
    def test_club_get_head_and_options_remain_public(self, get_queryset):
        get_queryset.return_value = Club.objects.none()

        for method in ('get', 'head', 'options'):
            with self.subTest(method=method):
                response = getattr(self.client, method)('/api/clubs/')
                self.assertEqual(response.status_code, 200)

    @patch.object(DepartmentViewSet, 'get_queryset')
    def test_department_get_head_and_options_remain_public(self, get_queryset):
        get_queryset.return_value = Department.objects.none()

        for method in ('get', 'head', 'options'):
            with self.subTest(method=method):
                response = getattr(self.client, method)('/api/departments/')
                self.assertEqual(response.status_code, 200)


class ImageValidationTests(SimpleTestCase):
    @staticmethod
    def make_image_upload(
        image_format='PNG',
        filename='avatar.png',
        content_type='image/png',
        size=(2, 2),
    ):
        image_buffer = BytesIO()
        Image.new('RGB', size, color='white').save(
            image_buffer,
            format=image_format,
        )
        return SimpleUploadedFile(
            filename,
            image_buffer.getvalue(),
            content_type=content_type,
        )

    def test_file_size_limit_is_strictly_under_two_megabytes(self):
        below_limit = SimpleUploadedFile(
            'avatar.png',
            b'x' * (MAX_IMAGE_SIZE - 1),
            content_type='image/png',
        )
        at_limit = SimpleUploadedFile(
            'avatar.png',
            b'x' * MAX_IMAGE_SIZE,
            content_type='image/png',
        )

        validate_file_size(below_limit)
        with self.assertRaisesMessage(
            ValidationError,
            'File size must be strictly under 2MB.',
        ):
            validate_file_size(at_limit)

    def test_supported_formats_are_decoded_from_real_image_signatures(self):
        supported = (
            ('JPEG', 'photo.jpg', 'image/jpeg'),
            ('PNG', 'photo.png', 'image/png'),
            ('WEBP', 'photo.webp', 'image/webp'),
        )

        for image_format, filename, content_type in supported:
            with self.subTest(image_format=image_format):
                upload = self.make_image_upload(
                    image_format,
                    filename,
                    content_type,
                )
                validate_image_content(upload)
                self.assertEqual(upload.tell(), 0)
                self.assertTrue(upload.read(1))

    def test_fake_image_signature_is_rejected_and_stream_is_reset(self):
        upload = SimpleUploadedFile(
            'avatar.png',
            b'not an image despite its name and MIME type',
            content_type='image/png',
        )

        with self.assertRaisesMessage(
            ValidationError,
            'The uploaded file is not a valid image.',
        ):
            validate_image_content(upload)

        self.assertEqual(upload.tell(), 0)
        self.assertEqual(upload.read(3), b'not')

    def test_malformed_truncated_image_is_rejected(self):
        valid_upload = self.make_image_upload()
        malformed = SimpleUploadedFile(
            'avatar.png',
            valid_upload.read()[:20],
            content_type='image/png',
        )

        with self.assertRaisesMessage(
            ValidationError,
            'The uploaded file is not a valid image.',
        ):
            validate_image_content(malformed)

        self.assertEqual(malformed.tell(), 0)

    def test_unsupported_decoded_format_is_rejected(self):
        upload = self.make_image_upload(
            image_format='GIF',
            filename='avatar.gif',
            content_type='image/gif',
        )

        with self.assertRaisesMessage(
            ValidationError,
            'Only JPEG, PNG, and WebP images are supported.',
        ):
            validate_image_content(upload)

    def test_image_mime_type_must_match_decoded_content(self):
        upload = self.make_image_upload(content_type='image/jpeg')

        with self.assertRaisesMessage(
            ValidationError,
            'The uploaded MIME type does not match the image content.',
        ):
            validate_image_content(upload)

        self.assertEqual(upload.tell(), 0)

    def test_filename_extension_must_match_decoded_content(self):
        upload = self.make_image_upload(
            filename='../misleading.jpg',
            content_type='image/png',
        )

        with self.assertRaisesMessage(
            ValidationError,
            'The filename extension does not match the image content.',
        ):
            validate_image_content(upload)

    def test_image_dimensions_are_limited_to_4000_pixels_per_axis(self):
        allowed = self.make_image_upload(size=(MAX_IMAGE_DIMENSION, 1))
        too_wide = self.make_image_upload(size=(MAX_IMAGE_DIMENSION + 1, 1))

        validate_image_content(allowed)
        with self.assertRaisesMessage(
            ValidationError,
            f'Image dimensions must not exceed {MAX_IMAGE_DIMENSION} pixels.',
        ):
            validate_image_content(too_wide)

        self.assertEqual(too_wide.tell(), 0)

    def test_uuid_path_discards_untrusted_basename_and_avoids_collisions(self):
        upload_path = uuid_path('events_pics')

        generated = {
            upload_path(None, '../../unsafe name.PnG')
            for _ in range(20)
        }

        self.assertEqual(len(generated), 20)
        for path in generated:
            folder, filename = path.split('/')
            stem, extension = os.path.splitext(filename)
            self.assertEqual(folder, 'events_pics')
            self.assertEqual(len(stem), 32)
            self.assertTrue(all(
                character in '0123456789abcdef'
                for character in stem
            ))
            self.assertEqual(extension, '.png')
            self.assertNotIn('..', path)

    def test_shared_validators_cover_every_existing_image_field(self):
        image_fields = (
            Club._meta.get_field('logo'),
            Club._meta.get_field('banner'),
            ClubEvent._meta.get_field('image_path'),
            UserMember._meta.get_field('image_path'),
        )

        for field in image_fields:
            with self.subTest(model=field.model.__name__, field=field.name):
                self.assertIn(validate_file_size, field.validators)
                self.assertIn(validate_image_content, field.validators)


class ClubEventFilterBackendTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.backend = ClubEventFilterBackend()

    def make_request(self, params=None, query_string=None):
        if query_string is not None:
            raw_request = self.factory.get(
                f'/api/club-events/?{query_string}',
            )
        else:
            raw_request = self.factory.get('/api/club-events/', params or {})
        return Request(raw_request)

    def filter_queryset(self, params=None, query_string=None):
        return self.backend.filter_queryset(
            self.make_request(params, query_string),
            ClubEvent.objects.all(),
            ClubEventViewSet(),
        )

    @staticmethod
    def sql_and_params(queryset):
        return queryset.query.sql_with_params()

    def test_exact_dimension_filters_can_be_combined(self):
        queryset = self.filter_queryset({
            'category': 'Tech',
            'club': 'leet-dev',
            'department': '1337',
            'status': 'planned',
        })

        sql, params = self.sql_and_params(queryset)

        self.assertIn('category', sql)
        self.assertIn('status', sql)
        self.assertIn('core_data_club', sql)
        self.assertIn('core_data_department', sql)
        for expected in ('Tech', 'leet-dev', '1337', 'planned'):
            self.assertIn(expected, params)

    def test_date_range_uses_overlap_semantics(self):
        queryset = self.filter_queryset({
            'from': '2026-11-01',
            'to': '2026-12-01',
        })

        sql, _ = self.sql_and_params(queryset)

        self.assertIn('ends_at', sql)
        self.assertIn('starts_at', sql)
        self.assertIn(' > ', sql)
        self.assertIn(' < ', sql)

    @patch('core_data.views.timezone.now')
    def test_upcoming_keeps_events_that_have_not_ended(self, mock_now):
        mock_now.return_value = datetime(
            2026,
            11,
            20,
            12,
            tzinfo=timezone.utc,
        )

        queryset = self.filter_queryset({'upcoming': 'true'})
        sql, params = self.sql_and_params(queryset)

        self.assertIn('ends_at', sql)
        self.assertTrue(any('2026-11-20' in str(value) for value in params))

    def test_upcoming_false_does_not_add_an_end_filter(self):
        queryset = self.filter_queryset({'upcoming': 'false'})

        self.assertFalse(queryset.query.where.children)

    def test_results_have_fixed_chronological_ordering(self):
        queryset = self.filter_queryset()
        ordering = queryset.query.order_by

        self.assertEqual(ordering[0].expression.name, 'starts_at')
        self.assertTrue(ordering[0].nulls_last)
        self.assertEqual(ordering[1], 'pk')

    def test_search_covers_documented_public_text_fields(self):
        view = ClubEventViewSet()
        view.request = self.make_request({'search': 'hack'})
        view.action = 'list'

        queryset = view.filter_queryset(ClubEvent.objects.all())
        sql, params = self.sql_and_params(queryset)

        self.assertIn('name', sql)
        self.assertIn('description', sql)
        self.assertIn('core_data_club', sql)
        self.assertIn('location', sql)
        self.assertTrue(all(value == '%hack%' for value in params[-4:]))

    def test_invalid_filter_values_are_rejected(self):
        invalid_requests = (
            ({'category': 'Unknown'}, 'category'),
            ({'status': 'archived'}, 'status'),
            ({'club': 'not a slug'}, 'club'),
            ({'department': 'not/a/slug'}, 'department'),
            ({'from': 'not-a-date'}, 'from'),
            ({'upcoming': 'yes'}, 'upcoming'),
            ({'ordering': '-created_at'}, 'ordering'),
        )

        for params, field in invalid_requests:
            with self.subTest(field=field):
                with self.assertRaises(DRFValidationError) as context:
                    self.filter_queryset(params)
                self.assertIn(field, context.exception.detail)

    def test_reversed_date_range_is_rejected(self):
        with self.assertRaises(DRFValidationError) as context:
            self.filter_queryset({
                'from': '2026-12-01',
                'to': '2026-11-01',
            })

        self.assertIn('to', context.exception.detail)

    def test_duplicate_filter_parameter_is_rejected(self):
        with self.assertRaises(DRFValidationError) as context:
            self.filter_queryset(query_string='category=Tech&category=Media')

        self.assertIn('category', context.exception.detail)

    def test_unsafe_search_shapes_are_rejected(self):
        invalid_queries = (
            'search=first&search=second',
            f'search={"x" * 201}',
        )

        for query_string in invalid_queries:
            with self.subTest(query_string=query_string[:40]):
                with self.assertRaises(DRFValidationError) as context:
                    self.filter_queryset(query_string=query_string)
                self.assertIn('search', context.exception.detail)


class ClubEventPaginationTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def paginate(self, params=None, query_string=None):
        if query_string is not None:
            raw_request = self.factory.get(
                f'/api/club-events/?{query_string}',
            )
        else:
            raw_request = self.factory.get('/api/club-events/', params or {})
        request = Request(raw_request)
        paginator = ClubEventPagination()
        page = paginator.paginate_queryset(list(range(25)), request)
        return paginator, page

    def test_default_page_size_and_response_envelope(self):
        paginator, page = self.paginate()
        response = paginator.get_paginated_response(page)

        self.assertEqual(len(page), 20)
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(
            set(response.data),
            {'count', 'next', 'previous', 'results'},
        )

    def test_page_size_can_be_customized_within_limit(self):
        _, page = self.paginate({'page_size': '5'})

        self.assertEqual(len(page), 5)

    def test_invalid_page_sizes_are_rejected(self):
        for page_size in ('0', '-1', 'not-a-number', '201'):
            with self.subTest(page_size=page_size):
                with self.assertRaises(DRFValidationError):
                    self.paginate({'page_size': page_size})

    def test_duplicate_page_size_is_rejected(self):
        with self.assertRaises(DRFValidationError):
            self.paginate(query_string='page_size=5&page_size=10')


class UserMemberPermissionTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.view = UserMemberViewSet()
        self.student = User(username='student')
        self.staff = User(username='staff', is_staff=True)
        self.superadmin = User(
            username='superadmin',
            role=User.Role.SUPERADMIN,
        )

    def is_allowed(self, user):
        permissions = self.view.get_permissions()
        self.assertEqual(len(permissions), 1)
        return permissions[0].has_permission(
            type('Request', (), {'user': user})(),
            self.view,
        )

    def test_anonymous_user_cannot_list_or_retrieve_members(self):
        for url in ('/api/members/', '/api/members/42/'):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 401)

    def test_non_staff_user_cannot_list_members(self):
        self.client.force_authenticate(user=self.student)

        self.assertEqual(self.client.get('/api/members/').status_code, 403)

    def test_non_staff_user_cannot_retrieve_another_member(self):
        self.client.force_authenticate(user=self.student)

        self.assertEqual(self.client.get('/api/members/42/').status_code, 403)

    def test_non_staff_user_cannot_write_members(self):
        self.client.force_authenticate(user=self.student)
        operations = (
            ('post', '/api/members/', {'username': 'blocked'}),
            ('put', '/api/members/42/', {'username': 'blocked'}),
            ('patch', '/api/members/42/', {'username': 'blocked'}),
            ('delete', '/api/members/42/', None),
        )
        for method, url, data in operations:
            with self.subTest(method=method):
                request = getattr(self.client, method)
                if data is None:
                    response = request(url)
                else:
                    response = request(url, data, format='json')
                self.assertEqual(response.status_code, 403)

    def test_staff_flag_alone_cannot_access_members(self):
        self.assertFalse(self.is_allowed(self.staff))

    def test_superadmin_can_list_retrieve_and_write_members(self):
        actions = (
            'list',
            'retrieve',
            'create',
            'update',
            'partial_update',
            'destroy',
        )
        for action in actions:
            with self.subTest(action=action):
                self.view.action = action
                self.assertTrue(self.is_allowed(self.superadmin))


class DepartmentAndMemberApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(title='Technology')

    def test_department_writes_remain_disabled(self):
        create_response = self.client.post(
            '/api/departments/',
            {'title': 'Arts'},
            format='json',
        )

        self.assertEqual(create_response.status_code, 405)
        self.assertEqual(Department.objects.count(), 1)

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

    def test_club_writes_remain_disabled_for_superadmin(self):
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

        self.assertEqual(response.status_code, 405)
        self.assertFalse(Club.objects.filter(name='Programming').exists())

    def test_assigned_board_member_can_create_club_event(self):
        head_user = User.objects.create_user(
            username='event-head',
            password='head-password-123',
            role=User.Role.BOARD_MEMBER,
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
        ClubBoardAssignment.objects.create(user=head_user, club=club)
        self.client.force_authenticate(user=head_user)

        response = self.client.post(
            '/api/club-events/',
            {
                'name': 'Demo Day',
                'category': 'Tech',
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

    def test_staff_flag_alone_cannot_mutate_core_data(self):
        staff_user = User.objects.create_user(
            username='staff-only',
            password='staff-password-123',
            is_staff=True,
        )
        club = Club.objects.create(
            name='Programming',
            department=self.department,
        )
        self.client.force_authenticate(user=staff_user)

        member_response = self.client.post(
            '/api/members/',
            {'username': 'unauthorized-member'},
            format='json',
        )
        event_response = self.client.post(
            '/api/club-events/',
            {
                'name': 'Unauthorized Event',
                'category': 'Tech',
                'parent_id': self.department.pk,
                'club': club.pk,
                'starts_at': '2026-11-01T10:00:00Z',
                'ends_at': '2026-11-01T12:00:00Z',
            },
            format='json',
        )

        self.assertEqual(member_response.status_code, 403)
        self.assertEqual(event_response.status_code, 403)

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
