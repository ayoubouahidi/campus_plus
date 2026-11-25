import importlib
import json
import os
from pathlib import Path
import subprocess
import sys

from channels.security.websocket import OriginValidator
from django.test import SimpleTestCase, override_settings


class ProductionSecuritySettingsTests(SimpleTestCase):
    project_root = Path(__file__).resolve().parent.parent
    security_environment_names = {
        'DEBUG',
        'DJANGO_ALLOWED_HOSTS',
        'DJANGO_CSRF_TRUSTED_ORIGINS',
        'DJANGO_HTTPS_ENABLED',
        'DJANGO_SSL_REDIRECT',
        'DJANGO_PUBLIC_MEDIA_BASE_URL',
        'DJANGO_HSTS_SECONDS',
        'DJANGO_HSTS_INCLUDE_SUBDOMAINS',
        'DJANGO_HSTS_PRELOAD',
        'DJANGO_SECRET_KEY',
    }

    settings_probe = """
import json
from unittest.mock import patch

with patch('dotenv.load_dotenv'):
    import backend.settings as settings

print(json.dumps({
    'debug': settings.DEBUG,
    'allowed_hosts': settings.ALLOWED_HOSTS,
    'csrf_trusted_origins': settings.CSRF_TRUSTED_ORIGINS,
    'secure_ssl_redirect': settings.SECURE_SSL_REDIRECT,
    'session_cookie_secure': settings.SESSION_COOKIE_SECURE,
    'csrf_cookie_secure': settings.CSRF_COOKIE_SECURE,
    'hsts_seconds': settings.SECURE_HSTS_SECONDS,
    'hsts_include_subdomains': settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
    'hsts_preload': settings.SECURE_HSTS_PRELOAD,
    'x_frame_options': settings.X_FRAME_OPTIONS,
    'content_type_nosniff': settings.SECURE_CONTENT_TYPE_NOSNIFF,
    'referrer_policy': settings.SECURE_REFERRER_POLICY,
    'proxy_ssl_header': settings.SECURE_PROXY_SSL_HEADER,
    'public_media_base_url': settings.PUBLIC_MEDIA_BASE_URL,
}))
"""

    def run_settings_probe(self, **overrides):
        environment = os.environ.copy()
        for name in self.security_environment_names:
            environment.pop(name, None)
        environment.update({
            'DJANGO_SECRET_KEY': (
                'test-only-settings-key-1234567890-'
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ-abcdef'
            ),
            'DEBUG': 'false',
            'DJANGO_ALLOWED_HOSTS': 'api.campusplus.example',
            'DJANGO_CSRF_TRUSTED_ORIGINS': (
                'https://app.campusplus.example'
            ),
            'DJANGO_HTTPS_ENABLED': 'true',
            'DJANGO_HSTS_SECONDS': '31536000',
            'DJANGO_HSTS_INCLUDE_SUBDOMAINS': 'false',
            'DJANGO_HSTS_PRELOAD': 'false',
            'REDIS_URL': 'redis://127.0.0.1:6379/15',
            'WS_AUTH_BACKEND': 'jwt',
            'DJANGO_PUBLIC_MEDIA_BASE_URL': (
                'https://app.campusplus.example'
            ),
        })
        environment.update(overrides)
        return subprocess.run(
            [sys.executable, '-c', self.settings_probe],
            cwd=self.project_root,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

    def successful_settings(self, **overrides):
        result = self.run_settings_probe(**overrides)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_development_configuration_keeps_local_http_available(self):
        settings = self.successful_settings(
            DEBUG='true',
            DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1',
            DJANGO_CSRF_TRUSTED_ORIGINS='http://localhost:3000',
            DJANGO_HTTPS_ENABLED='false',
            DJANGO_HSTS_SECONDS='0',
        )

        self.assertTrue(settings['debug'])
        self.assertEqual(settings['allowed_hosts'], ['localhost', '127.0.0.1'])
        self.assertEqual(
            settings['csrf_trusted_origins'],
            ['http://localhost:3000'],
        )
        self.assertFalse(settings['secure_ssl_redirect'])
        self.assertFalse(settings['session_cookie_secure'])
        self.assertFalse(settings['csrf_cookie_secure'])
        self.assertEqual(settings['hsts_seconds'], 0)

    def test_production_https_disables_debug_and_secures_cookies(self):
        settings = self.successful_settings()

        self.assertFalse(settings['debug'])
        self.assertTrue(settings['secure_ssl_redirect'])
        self.assertTrue(settings['session_cookie_secure'])
        self.assertTrue(settings['csrf_cookie_secure'])
        self.assertEqual(settings['hsts_seconds'], 31536000)
        self.assertEqual(
            settings['public_media_base_url'],
            'https://app.campusplus.example',
        )
        self.assertEqual(settings['x_frame_options'], 'DENY')
        self.assertTrue(settings['content_type_nosniff'])
        self.assertEqual(settings['referrer_policy'], 'same-origin')
        self.assertEqual(
            settings['proxy_ssl_header'],
            ['HTTP_X_FORWARDED_PROTO', 'https'],
        )

    @override_settings(
        ALLOWED_HOSTS=['approved.example'],
        DEBUG=False,
        SECURE_SSL_REDIRECT=False,
    )
    def test_unapproved_http_host_is_rejected(self):
        rejected = self.client.get('/api/health/', HTTP_HOST='evil.example')
        approved = self.client.get(
            '/api/health/',
            HTTP_HOST='approved.example',
        )

        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(approved.status_code, 200)

    def test_proxy_https_keeps_secure_cookies_without_ssl_redirect(self):
        settings = self.successful_settings(
            DJANGO_SSL_REDIRECT='false',
        )

        self.assertFalse(settings['debug'])
        self.assertFalse(settings['secure_ssl_redirect'])
        self.assertTrue(settings['session_cookie_secure'])
        self.assertTrue(settings['csrf_cookie_secure'])
        self.assertEqual(settings['hsts_seconds'], 31536000)

    def test_only_explicit_csrf_origins_are_trusted(self):
        settings = self.successful_settings(
            DJANGO_CSRF_TRUSTED_ORIGINS=(
                'https://app.campusplus.example,'
                'https://admin.campusplus.example'
            ),
        )

        self.assertEqual(settings['csrf_trusted_origins'], [
            'https://app.campusplus.example',
            'https://admin.campusplus.example',
        ])

    def test_insecure_or_malformed_configuration_fails_closed(self):
        invalid_cases = (
            ({'DEBUG': 'sometimes'}, 'DEBUG'),
            ({'DJANGO_SECRET_KEY': 'short'}, 'DJANGO_SECRET_KEY'),
            ({'DJANGO_ALLOWED_HOSTS': '*'}, 'DJANGO_ALLOWED_HOSTS'),
            (
                {'DJANGO_ALLOWED_HOSTS': 'https://api.example'},
                'DJANGO_ALLOWED_HOSTS',
            ),
            ({'DJANGO_ALLOWED_HOSTS': 'bad..example'}, 'DJANGO_ALLOWED_HOSTS'),
            (
                {'DJANGO_CSRF_TRUSTED_ORIGINS': 'not-an-origin'},
                'DJANGO_CSRF_TRUSTED_ORIGINS',
            ),
            (
                {'DJANGO_CSRF_TRUSTED_ORIGINS': 'https://bad..example'},
                'DJANGO_CSRF_TRUSTED_ORIGINS',
            ),
            (
                {'DJANGO_CSRF_TRUSTED_ORIGINS': 'http://app.example'},
                'DJANGO_CSRF_TRUSTED_ORIGINS',
            ),
            ({'DJANGO_HTTPS_ENABLED': 'sometimes'}, 'DJANGO_HTTPS_ENABLED'),
            ({'DJANGO_SSL_REDIRECT': 'sometimes'}, 'DJANGO_SSL_REDIRECT'),
            (
                {'DJANGO_PUBLIC_MEDIA_BASE_URL': 'http://app.example'},
                'DJANGO_PUBLIC_MEDIA_BASE_URL',
            ),
            (
                {'DJANGO_PUBLIC_MEDIA_BASE_URL': 'https://app.example/media'},
                'DJANGO_PUBLIC_MEDIA_BASE_URL',
            ),
            ({'DJANGO_HSTS_SECONDS': '-1'}, 'DJANGO_HSTS_SECONDS'),
            (
                {
                    'DJANGO_HSTS_SECONDS': '0',
                    'DJANGO_HSTS_PRELOAD': 'true',
                },
                'HSTS',
            ),
        )

        for overrides, expected_error in invalid_cases:
            with self.subTest(overrides=overrides):
                result = self.run_settings_probe(**overrides)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(
                    expected_error,
                    result.stderr + result.stdout,
                )

    @override_settings(
        ALLOWED_HOSTS=['secure.example'],
        SECURE_HSTS_SECONDS=3600,
        SECURE_HSTS_INCLUDE_SUBDOMAINS=False,
        SECURE_HSTS_PRELOAD=False,
        SECURE_SSL_REDIRECT=True,
    )
    def test_secure_responses_include_browser_protection_headers(self):
        response = self.client.get(
            '/api/health/',
            HTTP_HOST='secure.example',
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response['X-Frame-Options'], 'DENY')
        self.assertEqual(response['Referrer-Policy'], 'same-origin')
        self.assertEqual(response['Strict-Transport-Security'], 'max-age=3600')

    @override_settings(WS_AUTH_BACKEND='jwt')
    def test_asgi_websocket_stack_keeps_allowed_host_origin_validation(self):
        sys.modules.pop('backend.asgi', None)
        asgi = importlib.import_module('backend.asgi')
        websocket_application = asgi.application.application_mapping[
            'websocket'
        ]

        self.assertIsInstance(websocket_application, OriginValidator)

    def test_environment_template_documents_security_configuration(self):
        template_path = self.project_root / '.env.example'
        if not template_path.is_file():
            self.skipTest(
                '.env.example is a source-only template intentionally excluded '
                'from the production image.'
            )
        template = template_path.read_text()

        for name in (
            'DEBUG',
            'DJANGO_ALLOWED_HOSTS',
            'DJANGO_CSRF_TRUSTED_ORIGINS',
            'DJANGO_HTTPS_ENABLED',
            'DJANGO_PUBLIC_MEDIA_BASE_URL',
            'DJANGO_HSTS_SECONDS',
            'DJANGO_HSTS_INCLUDE_SUBDOMAINS',
            'DJANGO_HSTS_PRELOAD',
        ):
            with self.subTest(name=name):
                self.assertIn(f'{name}=', template)
