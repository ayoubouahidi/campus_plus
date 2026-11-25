from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIClient
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken


@override_settings(WS_AUTH_BACKEND='jwt')
class RealtimeTokenEndpointTests(SimpleTestCase):
    endpoint = '/api/realtime/token/'

    def setUp(self):
        self.user = SimpleNamespace(
            id=37,
            pk=37,
            is_active=True,
            is_authenticated=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def issue_token(self, data=None):
        return self.client.post(self.endpoint, data or {}, format='json')

    def test_authenticated_user_receives_valid_access_jwt(self):
        response = self.issue_token()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {'access', 'expires_in'})
        AccessToken(response.data['access'])

    def test_anonymous_user_is_rejected(self):
        response = APIClient().post(self.endpoint, {}, format='json')

        self.assertEqual(response.status_code, 401)
        self.assertNotIn('access', response.data)

    def test_inactive_user_is_rejected(self):
        self.user.is_active = False

        response = self.issue_token()

        self.assertEqual(response.status_code, 403)
        self.assertNotIn('access', response.data)

    def test_client_cannot_choose_token_identity_or_role(self):
        response = self.issue_token({
            'user_id': 999,
            'username': 'attacker-selected',
            'role': 'SUPERADMIN',
        })
        token = AccessToken(response.data['access'])

        self.assertEqual(token[api_settings.USER_ID_CLAIM], str(self.user.pk))
        self.assertNotIn('role', token)
        self.assertNotIn('username', token)

    def test_token_contains_authenticated_user_id(self):
        response = self.issue_token()
        token = AccessToken(response.data['access'])

        self.assertEqual(token[api_settings.USER_ID_CLAIM], str(self.user.pk))

    def test_issued_token_is_access_not_refresh(self):
        token = AccessToken(self.issue_token().data['access'])

        self.assertEqual(
            token[api_settings.TOKEN_TYPE_CLAIM],
            'access',
        )

    @patch.object(AccessToken, 'lifetime', timedelta(seconds=45))
    def test_expiry_uses_configured_access_token_lifetime(self):
        response = self.issue_token()
        token = AccessToken(response.data['access'])

        self.assertEqual(response.data['expires_in'], 45)
        self.assertEqual(token['exp'] - token['iat'], 45)

    def test_get_and_unsupported_methods_are_rejected(self):
        for method in ('get', 'put', 'patch', 'delete', 'options'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.endpoint)
                self.assertEqual(response.status_code, 405)
                self.assertNotIn('access', response.data)

    def test_responses_are_not_cacheable(self):
        for response in (
            self.issue_token(),
            APIClient().post(self.endpoint, {}, format='json'),
        ):
            with self.subTest(status=response.status_code):
                self.assertEqual(response['Cache-Control'], 'no-store')

    @override_settings(WS_AUTH_BACKEND='token_dev')
    def test_disabled_jwt_websocket_mode_does_not_issue_token(self):
        response = self.issue_token()

        self.assertEqual(response.status_code, 503)
        self.assertNotIn('access', response.data)

    def test_openapi_documents_only_post_and_minimal_response(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)
        path = schema['paths'][self.endpoint]
        response_schema = path['post']['responses']['200']['content'][
            'application/json'
        ]['schema']

        self.assertEqual(set(path), {'post'})
        self.assertEqual(path['post']['security'], [{'tokenAuth': []}])
        self.assertEqual(
            response_schema,
            {'$ref': '#/components/schemas/RealtimeTokenResponse'},
        )
        properties = schema['components']['schemas'][
            'RealtimeTokenResponse'
        ]['properties']
        self.assertEqual(set(properties), {'access', 'expires_in'})
