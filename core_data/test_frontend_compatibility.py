from datetime import datetime, time, timezone
from unittest.mock import patch

from django.test import SimpleTestCase
from drf_spectacular.generators import SchemaGenerator
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

from .models import Club, ClubEvent, Department, UserMember
from .serializers import ClubEventSerializer, ClubSerializer, DepartmentSerializer
from .views import (
    ClubEventFilterBackend,
    ClubEventPagination,
    ClubEventViewSet,
    ClubViewSet,
    DepartmentViewSet,
)


class FrontendEventCompatibilityTests(SimpleTestCase):
    maxDiff = None

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
            image_path='events_pics/hackathon.webp',
            starts_at=datetime(2026, 11, 21, 9, tzinfo=timezone.utc),
            ends_at=datetime(2026, 11, 21, 17, tzinfo=timezone.utc),
            location='Agora Hall',
            category='Tech',
            status='planned',
            capacity=150,
        )

    def test_event_shape_preserves_frontend_aliases_and_original_fields(self):
        request = APIRequestFactory().get('/api/club-events/3/')
        data = ClubEventSerializer(
            self.event,
            context={'request': request},
        ).data

        self.assertEqual(set(data), {
            'id', 'title', 'name', 'description', 'parent_id', 'club',
            'club_id', 'club_name', 'club_slug', 'parent',
            'department_name', 'department_slug', 'flyer_url', 'starts_at',
            'ends_at', 'start_time', 'end_time', 'location', 'category',
            'status', 'capacity', 'rsvps_count', 'has_user_rsvpd',
            'attendees_preview', 'created_at', 'updated_at',
        })
        self.assertEqual(data['title'], data['name'])
        self.assertEqual(data['start_time'], data['starts_at'])
        self.assertEqual(data['end_time'], data['ends_at'])
        self.assertEqual(
            data['flyer_url'],
            'http://testserver/media/events_pics/hackathon.webp',
        )
        self.assertEqual(data['parent_id'], 1)
        self.assertEqual(data['club'], 2)

    def test_event_relationship_names_capacity_and_status_are_stable(self):
        data = ClubEventSerializer(self.event).data

        self.assertEqual(data['club_id'], 2)
        self.assertEqual(data['club_name'], 'LEET Dev')
        self.assertEqual(data['club_slug'], 'leet-dev')
        self.assertEqual(data['department_name'], '1337 Coding School')
        self.assertEqual(data['department_slug'], '1337')
        self.assertEqual(data['capacity'], 150)
        self.assertEqual(data['status'], 'planned')

    def test_category_status_and_capacity_contract_matches_documentation(self):
        self.assertEqual(
            {value for value, _ in ClubEvent.CATEGORY_CHOICES},
            {
                'Tech', 'Media', 'Music', 'Sports', 'Business',
                'EventsOrganization', 'Gaming',
            },
        )
        self.assertEqual(
            {value for value, _ in ClubEvent.STATUS_CHOICES},
            {'planned', 'ongoing', 'completed', 'cancelled'},
        )
        capacity_field = ClubEvent._meta.get_field('capacity')
        self.assertTrue(capacity_field.null)
        self.assertEqual(capacity_field.get_internal_type(), 'PositiveIntegerField')

    def test_missing_images_and_nullable_historical_values_are_consistent(self):
        nullable_department = Department(
            id=4,
            title='Department Pending Slug',
            slug=None,
        )
        historical_event = ClubEvent(
            id=5,
            name='Schedule Pending',
            parent_id=nullable_department,
        )

        data = ClubEventSerializer(historical_event).data

        self.assertEqual(data['flyer_url'], '')
        self.assertIsNone(data['club'])
        self.assertIsNone(data['club_id'])
        self.assertIsNone(data['club_name'])
        self.assertIsNone(data['club_slug'])
        self.assertIsNone(data['department_slug'])
        self.assertIsNone(data['category'])
        self.assertIsNone(data['capacity'])
        self.assertIsNone(data['starts_at'])
        self.assertIsNone(data['ends_at'])
        self.assertIsNone(data['start_time'])
        self.assertIsNone(data['end_time'])
        self.assertEqual(data['status'], 'planned')

    def test_event_list_uses_documented_pagination_envelope(self):
        request = Request(APIRequestFactory().get('/api/club-events/'))
        paginator = ClubEventPagination()
        page = paginator.paginate_queryset(list(range(25)), request)
        response = paginator.get_paginated_response(page)

        self.assertEqual(len(page), 20)
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(
            set(response.data),
            {'count', 'next', 'previous', 'results'},
        )

    def test_event_filter_validation_preserves_documented_contract(self):
        backend = ClubEventFilterBackend()
        factory = APIRequestFactory()
        valid_request = Request(factory.get('/api/club-events/', {
            'category': 'Tech',
            'club': 'leet-dev',
            'department': '1337',
            'status': 'planned',
            'from': '2026-11-01',
            'to': '2026-12-01',
            'upcoming': 'true',
        }))
        queryset = backend.filter_queryset(
            valid_request,
            ClubEvent.objects.all(),
            ClubEventViewSet(),
        )
        sql, params = queryset.query.sql_with_params()

        for field in ('category', 'status', 'starts_at', 'ends_at'):
            self.assertIn(field, sql)
        for value in ('Tech', 'leet-dev', '1337', 'planned'):
            self.assertIn(value, params)

        invalid_requests = (
            ({'category': 'Unknown'}, 'category'),
            ({'status': 'archived'}, 'status'),
            ({'club': 'not a slug'}, 'club'),
            ({'department': 'not/a/slug'}, 'department'),
            ({'from': 'not-a-date'}, 'from'),
            ({'upcoming': 'yes'}, 'upcoming'),
            ({'ordering': '-created_at'}, 'ordering'),
        )
        for query, field in invalid_requests:
            with self.subTest(field=field):
                request = Request(factory.get('/api/club-events/', query))
                with self.assertRaises(DRFValidationError) as context:
                    backend.filter_queryset(
                        request,
                        ClubEvent.objects.all(),
                        ClubEventViewSet(),
                    )
                self.assertIn(field, context.exception.detail)


class FrontendClubAndDepartmentCompatibilityTests(SimpleTestCase):
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

    def test_club_public_shape_is_documented_and_private_contacts_stay_absent(self):
        request = APIRequestFactory().get('/api/clubs/leet-dev/')
        data = ClubSerializer(self.club, context={'request': request}).data

        self.assertTrue({
            'id', 'slug', 'name', 'description', 'department',
            'department_id', 'department_name', 'department_slug', 'logo_url',
            'banner_url', 'president', 'president_name', 'member_count',
            'event_count', 'upcoming_event_count', 'meeting_day',
            'meeting_time', 'meeting_location', 'is_active', 'created_at',
            'updated_at',
        }.issubset(data))
        self.assertEqual(data['slug'], 'leet-dev')
        self.assertEqual(data['department_name'], '1337 Coding School')
        self.assertEqual(data['president_name'], 'Yassine El Amrani')
        self.assertEqual(data['member_count'], 86)
        for private_field in (
            'contact_email', 'president_email', 'president_phone', 'phone',
        ):
            self.assertNotIn(private_field, data)

    @patch.object(ClubViewSet, 'get_queryset', return_value=[])
    def test_club_detail_lookup_is_slug_based_and_list_is_bare_array(
        self,
        get_queryset,
    ):
        self.assertEqual(ClubViewSet.lookup_field, 'slug')

        response = APIClient().get('/api/clubs/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        get_queryset.assert_called_once()

    def test_unauthorized_club_writes_remain_disabled(self):
        client = APIClient()
        operations = (
            ('post', '/api/clubs/'),
            ('put', '/api/clubs/leet-dev/'),
            ('patch', '/api/clubs/leet-dev/'),
            ('delete', '/api/clubs/leet-dev/'),
        )
        for method, path in operations:
            with self.subTest(method=method):
                response = getattr(client, method)(path, {}, format='json')
                self.assertEqual(response.status_code, 405)

    def test_department_shape_and_nullable_slug_match_interim_contract(self):
        data = DepartmentSerializer(self.department).data
        nullable = DepartmentSerializer(Department(
            id=11,
            title='Slug Pending',
            slug=None,
        )).data

        self.assertEqual(data, {
            'id': 10,
            'name': '1337 Coding School',
            'title': '1337 Coding School',
            'slug': '1337',
        })
        self.assertEqual(nullable, {
            'id': 11,
            'name': 'Slug Pending',
            'title': 'Slug Pending',
            'slug': None,
        })

    @patch.object(DepartmentViewSet, 'get_queryset', return_value=[])
    def test_department_list_is_bare_and_writes_remain_disabled(
        self,
        get_queryset,
    ):
        client = APIClient()
        response = client.get('/api/departments/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        get_queryset.assert_called_once()

        for method, path in (
            ('post', '/api/departments/'),
            ('put', '/api/departments/10/'),
            ('patch', '/api/departments/10/'),
            ('delete', '/api/departments/10/'),
        ):
            with self.subTest(method=method):
                rejected = getattr(client, method)(path, {}, format='json')
                self.assertEqual(rejected.status_code, 405)


class FrontendOpenApiCompatibilityTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.schema = SchemaGenerator().get_schema(request=None, public=True)

    def test_public_routes_and_documented_response_shapes_are_present(self):
        paths = self.schema['paths']
        expected_public_gets = (
            '/api/club-events/',
            '/api/club-events/{id}/',
            '/api/clubs/',
            '/api/clubs/{slug}/',
            '/api/departments/',
            '/api/departments/{id}/',
        )
        for path in expected_public_gets:
            with self.subTest(path=path):
                self.assertIn('get', paths[path])
                self.assertNotIn('security', paths[path]['get'])

        event_list = paths['/api/club-events/']['get']['responses']['200'][
            'content'
        ]['application/json']['schema']
        club_list = paths['/api/clubs/']['get']['responses']['200']['content'][
            'application/json'
        ]['schema']
        department_list = paths['/api/departments/']['get']['responses']['200'][
            'content'
        ]['application/json']['schema']

        self.assertEqual(
            event_list,
            {'$ref': '#/components/schemas/PaginatedClubEventList'},
        )
        self.assertEqual(club_list['type'], 'array')
        self.assertEqual(
            club_list['items'],
            {'$ref': '#/components/schemas/Club'},
        )
        self.assertEqual(department_list['type'], 'array')
        self.assertEqual(
            department_list['items'],
            {'$ref': '#/components/schemas/Department'},
        )

    def test_openapi_event_and_privacy_shapes_match_current_contract(self):
        components = self.schema['components']['schemas']
        event = components['ClubEvent']['properties']
        club = components['Club']['properties']
        department = components['Department']['properties']

        self.assertTrue({
            'title', 'name', 'starts_at', 'ends_at', 'start_time', 'end_time',
            'flyer_url', 'club_name', 'club_slug', 'department_name',
            'department_slug', 'capacity', 'status',
        }.issubset(event))
        self.assertEqual(
            set(components['CategoryEnum']['enum']),
            {
                'Tech', 'Media', 'Music', 'Sports', 'Business',
                'EventsOrganization', 'Gaming',
            },
        )
        self.assertTrue(event['capacity']['nullable'])
        self.assertTrue(department['slug']['nullable'])
        self.assertEqual(club['president_email']['type'], 'string')
        self.assertEqual(club['president_phone']['type'], 'string')

    def test_rsvp_and_integrated_auth_routes_are_present(self):
        paths = self.schema['paths']
        for implemented_path in (
            '/api/club-events/{id}/rsvp/',
            '/api/club-events/{id}/attendees/',
        ):
            with self.subTest(path=implemented_path):
                self.assertIn(implemented_path, paths)

        self.assertNotIn('/api/me/rsvps/', paths)

        for implemented_path in (
            '/api/auth/login/',
            '/api/auth/logout/',
            '/api/me/',
            '/auth/sync',
        ):
            with self.subTest(path=implemented_path):
                self.assertIn(implemented_path, paths)

        event = self.schema['components']['schemas']['ClubEvent']['properties']
        for implemented_field in (
            'rsvps_count', 'has_user_rsvpd', 'attendees_preview',
        ):
            self.assertIn(implemented_field, event)

    def test_realtime_token_openapi_matches_a11_contract(self):
        operation = self.schema['paths']['/api/realtime/token/']

        self.assertEqual(set(operation), {'post'})
        post = operation['post']
        self.assertEqual(post['security'], [{'tokenAuth': []}])
        self.assertNotIn('requestBody', post)
        self.assertEqual(set(post['responses']), {'200', '401', '403', '503'})
        response_schema = post['responses']['200']['content'][
            'application/json'
        ]['schema']
        self.assertEqual(
            response_schema,
            {'$ref': '#/components/schemas/RealtimeTokenResponse'},
        )
        token_response = self.schema['components']['schemas'][
            'RealtimeTokenResponse'
        ]
        self.assertEqual(
            set(token_response['properties']),
            {'access', 'expires_in'},
        )
