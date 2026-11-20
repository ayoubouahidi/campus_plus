from datetime import datetime, time, timezone
from io import BytesIO
import os
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase
from PIL import Image
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

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
    ClubViewSet,
    ClubEventFilterBackend,
    ClubEventPagination,
    ClubEventViewSet,
    DepartmentViewSet,
)


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

    def test_authentication_dependent_rsvp_fields_are_not_stubbed(self):
        data = ClubEventSerializer(self.event).data

        self.assertNotIn('rsvps_count', data)
        self.assertNotIn('has_user_rsvpd', data)
        self.assertNotIn('attendees_preview', data)

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
