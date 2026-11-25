from datetime import timedelta
from importlib import import_module
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Club, ClubEvent, Department, Rsvp, UserMember
from .views import public_event_broadcast_data


User = get_user_model()


class AuthenticatedClubContactTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(
            title='1337 Coding School',
            slug='1337',
        )
        self.president_user = User.objects.create_user(
            username='president-user',
            email='president@example.test',
            password='test-password',
        )
        self.president = UserMember.objects.create(
            username='president-profile',
            user=self.president_user,
            phone='+212600000000',
        )
        self.club = Club.objects.create(
            name='LEET Dev',
            department=self.department,
            head=self.president,
        )
        self.viewer = User.objects.create_user(
            username='viewer',
            password='test-password',
        )

    def test_anonymous_list_and_detail_hide_contacts_and_disable_shared_cache(self):
        for path in ('/api/clubs/', f'/api/clubs/{self.club.slug}/'):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                item = response.data[0] if isinstance(response.data, list) else response.data
                self.assertNotIn('president_email', item)
                self.assertNotIn('president_phone', item)
                self.assertEqual(response['Cache-Control'], 'private, no-store')
                self.assertIn('Authorization', response['Vary'])

    def test_authenticated_active_user_receives_authoritative_contacts(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.get(f'/api/clubs/{self.club.slug}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['president_email'], 'president@example.test')
        self.assertEqual(response.data['president_phone'], '+212600000000')

    def test_missing_contacts_are_empty_strings_for_authenticated_contract(self):
        no_contact = Club.objects.create(
            name='No Contact Club',
            department=self.department,
        )
        self.client.force_authenticate(self.viewer)

        response = self.client.get(f'/api/clubs/{no_contact.slug}/')

        self.assertEqual(response.data['president_email'], '')
        self.assertEqual(response.data['president_phone'], '')

    def test_invalid_and_inactive_token_credentials_reveal_nothing(self):
        invalid = APIClient()
        invalid.credentials(HTTP_AUTHORIZATION='Token definitely-invalid')
        self.assertEqual(invalid.get('/api/clubs/').status_code, 401)

        token = Token.objects.create(user=self.viewer)
        self.viewer.is_active = False
        self.viewer.save(update_fields=['is_active'])
        inactive = APIClient()
        inactive.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.assertEqual(inactive.get('/api/clubs/').status_code, 401)

    def test_authenticated_club_list_query_count_is_bounded(self):
        for number in range(5):
            Club.objects.create(
                name=f'Club {number}',
                department=self.department,
                head=self.president,
            )
        self.client.force_authenticate(self.viewer)

        with self.assertNumQueries(1):
            response = self.client.get('/api/clubs/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 6)

    def test_calendar_projection_rejects_private_contact_fields(self):
        projected = public_event_broadcast_data({
            'id': 42,
            'title': 'Safe event',
            'president_email': 'private@example.test',
            'president_phone': '+212600000000',
            'has_user_rsvpd': True,
            'attendees_preview': [{'id': 9}],
        })
        self.assertNotIn('president_email', projected)
        self.assertNotIn('president_phone', projected)
        self.assertFalse(projected['has_user_rsvpd'])
        self.assertEqual(projected['attendees_preview'], [])


class RsvpHistoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(
            title='1337 Coding School',
            slug='1337',
        )
        self.user_a = User.objects.create_user(username='user-a', password='unused')
        self.user_b = User.objects.create_user(username='user-b', password='unused')
        now = timezone.now()
        self.past = ClubEvent.objects.create(
            name='Past registered event',
            parent_id=self.department,
            starts_at=now - timedelta(days=2),
            ends_at=now - timedelta(days=1),
            category='Tech',
        )
        self.future = ClubEvent.objects.create(
            name='Future registered event',
            parent_id=self.department,
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=2),
            category='Tech',
        )
        self.other = ClubEvent.objects.create(
            name='Other user event',
            parent_id=self.department,
            starts_at=now + timedelta(days=3),
            ends_at=now + timedelta(days=4),
            category='Tech',
        )
        Rsvp.objects.create(user=self.user_a, event=self.past)
        Rsvp.objects.create(user=self.user_a, event=self.future)
        Rsvp.objects.create(user=self.user_b, event=self.other)

    def test_anonymous_history_is_rejected(self):
        response = self.client.get('/api/club-events/?rsvped=true')
        self.assertEqual(response.status_code, 401)

    def test_history_is_current_user_only_includes_past_and_future_and_hides_attendees(self):
        self.client.force_authenticate(self.user_a)

        response = self.client.get('/api/club-events/?rsvped=true')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(
            [item['id'] for item in response.data['results']],
            [self.past.pk, self.future.pk],
        )
        self.assertTrue(all(item['has_user_rsvpd'] for item in response.data['results']))
        self.assertTrue(all(item['attendees_preview'] == [] for item in response.data['results']))

    def test_other_user_cannot_select_an_owner_and_cancelled_rsvp_disappears(self):
        self.client.force_authenticate(self.user_b)
        response = self.client.get(
            f'/api/club-events/?rsvped=true&user_id={self.user_a.pk}'
        )
        self.assertEqual([item['id'] for item in response.data['results']], [self.other.pk])

        Rsvp.objects.filter(user=self.user_a, event=self.future).delete()
        self.client.force_authenticate(self.user_a)
        response = self.client.get('/api/club-events/?rsvped=true')
        self.assertEqual([item['id'] for item in response.data['results']], [self.past.pk])

    def test_history_uses_bounded_pagination_and_validates_boolean(self):
        self.client.force_authenticate(self.user_a)
        first_page = self.client.get('/api/club-events/?rsvped=true&page_size=1')
        invalid = self.client.get('/api/club-events/?rsvped=yes')
        self.assertEqual(first_page.data['count'], 2)
        self.assertEqual(len(first_page.data['results']), 1)
        self.assertEqual(invalid.status_code, 400)


class PublicMediaUrlTests(TestCase):
    def setUp(self):
        department = Department.objects.create(title='1337', slug='1337-media')
        self.club = Club.objects.create(
            name='Media Club',
            department=department,
            logo='club_logos/logo.webp',
            banner='club_banners/banner.webp',
        )
        self.event = ClubEvent.objects.create(
            name='Media Event',
            parent_id=department,
            image_path='events_pics/flyer.webp',
        )

    @override_settings(
        PUBLIC_MEDIA_BASE_URL='https://campus.example',
        ALLOWED_HOSTS=['testserver', 'web'],
    )
    def test_public_origin_replaces_internal_request_host_for_all_images(self):
        event = self.client.get(
            f'/api/club-events/{self.event.pk}/',
            HTTP_HOST='web:8000',
        )
        club = self.client.get(
            f'/api/clubs/{self.club.slug}/',
            HTTP_HOST='web:8000',
        )
        self.assertEqual(
            event.data['flyer_url'],
            'https://campus.example/media/events_pics/flyer.webp',
        )
        self.assertEqual(
            club.data['logo_url'],
            'https://campus.example/media/club_logos/logo.webp',
        )
        self.assertEqual(
            club.data['banner_url'],
            'https://campus.example/media/club_banners/banner.webp',
        )
        self.assertNotIn('web:8000', str(event.data) + str(club.data))

    @override_settings(PUBLIC_MEDIA_BASE_URL='https://campus.example')
    def test_missing_images_keep_existing_empty_contract(self):
        self.event.image_path = ''
        self.club.logo = ''
        self.club.banner = ''
        self.event.save(update_fields=['image_path'])
        self.club.save(update_fields=['logo', 'banner'])
        self.assertEqual(
            self.client.get(f'/api/club-events/{self.event.pk}/').data['flyer_url'],
            '',
        )
        data = self.client.get(f'/api/clubs/{self.club.slug}/').data
        self.assertEqual(data['logo_url'], '')
        self.assertIsNone(data['banner_url'])


class ClubSlugSafetyTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(title='1337', slug='slug-school')

    def test_new_clubs_receive_valid_deterministic_unique_slugs(self):
        first = Club.objects.create(name='Café Code', department=self.department)
        second_department = Department.objects.create(title='Other', slug='other-school')
        second = Club.objects.create(name='Café Code', department=second_department)
        fallback = Club.objects.create(name='***', department=self.department)

        self.assertEqual(first.slug, 'cafe-code')
        self.assertEqual(second.slug, 'cafe-code-2')
        self.assertEqual(fallback.slug, 'club')

    def test_forward_backfill_is_idempotent_and_conflict_safe(self):
        existing = Club.objects.create(name='Robotics', department=self.department)
        pending_department = Department.objects.create(title='Pending', slug='pending-school')
        pending = Club.objects.create(name='Robotics', department=pending_department)
        Club.objects.filter(pk=pending.pk).update(slug='')
        migration = import_module('core_data.migrations.0012_backfill_club_slugs')

        class CurrentApps:
            @staticmethod
            def get_model(app_label, model_name):
                return Club

        schema_editor = SimpleNamespace(connection=connection)
        migration.backfill_club_slugs(CurrentApps(), schema_editor)
        migration.backfill_club_slugs(CurrentApps(), schema_editor)

        existing.refresh_from_db()
        pending.refresh_from_db()
        self.assertEqual(existing.slug, 'robotics')
        self.assertEqual(pending.slug, 'robotics-2')
