from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
import re
import sys

from django.test import SimpleTestCase
from drf_spectacular.generators import SchemaGenerator


class HealthCheckTests(SimpleTestCase):
    def test_infrastructure_health_contract_is_public_and_minimal(self):
        response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response.json(), {
            'status': 'ok',
            'message': 'API is running',
        })

    def test_live_contract_is_plain_text(self):
        response = self.client.get('/api/health/live')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/plain')
        self.assertEqual(response.content, b'ok')

    def test_head_is_supported_without_a_response_body(self):
        for url in ('/api/health/', '/api/health/live'):
            with self.subTest(url=url):
                response = self.client.head(url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.content, b'')

    def test_unsafe_and_unsupported_methods_are_rejected(self):
        for url in ('/api/health/', '/api/health/live'):
            for method in ('post', 'put', 'patch', 'delete', 'options'):
                with self.subTest(url=url, method=method):
                    response = getattr(self.client, method)(url)
                    self.assertEqual(response.status_code, 405)
                    self.assertEqual(
                        set(response.headers['Allow'].split(', ')),
                        {'GET', 'HEAD'},
                    )

    def test_responses_do_not_disclose_dependency_or_configuration_details(self):
        responses = (
            self.client.get('/api/health/'),
            self.client.get('/api/health/live'),
        )
        forbidden_terms = (
            b'database',
            b'redis',
            b'channels',
            b'password',
            b'secret',
            b'environment',
            b'settings',
            b'traceback',
        )

        for response in responses:
            content = response.content.lower()
            for term in forbidden_terms:
                with self.subTest(path=response.request['PATH_INFO'], term=term):
                    self.assertNotIn(term, content)


class PublicOpenApiSchemaTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.schema = SchemaGenerator().get_schema(request=None, public=True)

    def test_public_paths_and_allowed_methods_match_runtime(self):
        expected_read_only_paths = (
            '/api/clubs/',
            '/api/clubs/{slug}/',
            '/api/departments/',
            '/api/departments/{id}/',
            '/api/health/',
            '/api/health/live',
        )

        for path in expected_read_only_paths:
            with self.subTest(path=path):
                self.assertEqual(set(self.schema['paths'][path]), {'get'})
                self.assertNotIn('security', self.schema['paths'][path]['get'])

        self.assertIn('/api/club-events/', self.schema['paths'])
        self.assertIn('/api/club-events/{id}/', self.schema['paths'])
        self.assertNotIn('security', self.schema['paths']['/api/club-events/']['get'])

    def test_event_list_documents_filters_fixed_ordering_pagination_and_errors(self):
        operation = self.schema['paths']['/api/club-events/']['get']
        parameters = {
            parameter['name']: parameter
            for parameter in operation['parameters']
        }

        self.assertEqual(
            set(parameters),
            {
                'category',
                'club',
                'department',
                'from',
                'page',
                'page_size',
                'search',
                'status',
                'to',
                'upcoming',
            },
        )
        self.assertNotIn('ordering', parameters)
        self.assertEqual(parameters['page_size']['schema']['minimum'], 1)
        self.assertEqual(parameters['page_size']['schema']['maximum'], 200)
        self.assertEqual(parameters['upcoming']['schema']['type'], 'boolean')
        self.assertIn('fixed', operation['description'])
        self.assertIn('400', operation['responses'])
        self.assertEqual(
            operation['responses']['200']['content']['application/json']['schema']['$ref'],
            '#/components/schemas/PaginatedClubEventList',
        )

    def test_public_components_use_correct_types_and_privacy_boundaries(self):
        components = self.schema['components']['schemas']
        club = components['Club']['properties']
        event = components['ClubEvent']['properties']
        department = components['Department']['properties']

        for count_field in ('member_count', 'event_count', 'upcoming_event_count'):
            self.assertEqual(club[count_field]['type'], 'integer')

        self.assertTrue(club['banner_url']['nullable'])
        self.assertEqual(club['logo_url']['type'], 'string')
        self.assertTrue(club['contact_email']['writeOnly'])
        self.assertNotIn('president_email', club)
        self.assertNotIn('president_phone', club)
        self.assertTrue(department['slug']['nullable'])

        self.assertEqual(event['rsvps_count']['type'], 'integer')
        self.assertEqual(event['has_user_rsvpd']['type'], 'boolean')
        self.assertEqual(event['attendees_preview']['type'], 'array')
        attendee = components['Attendee']['properties']
        self.assertEqual(set(attendee), {'id', 'full_name', 'avatar_url'})

    def test_health_media_types_distinguish_json_and_plain_text_liveness(self):
        health_content = self.schema['paths']['/api/health/']['get'][
            'responses'
        ]['200']['content']
        live_content = self.schema['paths']['/api/health/live']['get'][
            'responses'
        ]['200']['content']

        self.assertEqual(set(health_content), {'application/json'})
        self.assertEqual(set(live_content), {'text/plain'})
        self.assertIn(
            'no database, Redis, or Channels checks',
            self.schema['paths']['/api/health/']['get']['description'],
        )

    def test_schema_endpoint_serves_generated_openapi_without_database(self):
        response = self.client.get('/api/schema/', {'format': 'json'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['openapi'], '3.0.3')


class EnvironmentConfigurationTests(SimpleTestCase):
    project_root = Path(__file__).resolve().parent.parent

    def test_declared_runtime_distributions_are_installed(self):
        requirement_lines = (
            self.project_root / 'requirements.txt'
        ).read_text().splitlines()
        distributions = []

        for line in requirement_lines:
            requirement = line.strip()
            if not requirement or requirement.startswith('#'):
                continue
            distributions.append(re.split(r'[<>=!~\[]', requirement, 1)[0])

        missing = []
        for distribution in distributions:
            try:
                version(distribution)
            except PackageNotFoundError:
                missing.append(distribution)

        self.assertEqual(missing, [])

    def test_python_version_sources_agree_with_running_interpreter(self):
        expected = (
            self.project_root / '.python-version'
        ).read_text().strip()
        dockerfile = (self.project_root / 'Dockerfile').read_text()
        setup_script = (self.project_root / 'setup.sh').read_text()

        self.assertEqual(expected, f'{sys.version_info.major}.{sys.version_info.minor}')
        self.assertIn(f'FROM python:{expected}-slim', dockerfile)
        self.assertIn(f'uv venv .venv --python {expected}', setup_script)

    def test_environment_template_documents_required_names_without_real_secrets(self):
        template = (self.project_root / '.env.example').read_text()
        configured_names = {
            line.split('=', 1)[0]
            for line in template.splitlines()
            if '=' in line and not line.lstrip().startswith('#')
        }

        self.assertTrue({
            'DJANGO_SECRET_KEY',
            'DEBUG',
            'DJANGO_ALLOWED_HOSTS',
            'REDIS_URL',
            'WS_AUTH_BACKEND',
            'POSTGRES_DB',
            'POSTGRES_USER',
            'POSTGRES_PASSWORD',
            'POSTGRES_PORT',
        }.issubset(configured_names))
        self.assertEqual(template.count('CHANGE_ME_GENERATE_A_UNIQUE_RANDOM_VALUE'), 2)

    def test_setup_installs_daphne_only_through_requirements(self):
        requirements = (self.project_root / 'requirements.txt').read_text()
        setup_script = (self.project_root / 'setup.sh').read_text()

        self.assertIn('daphne>=4.2,<5.0', requirements)
        self.assertNotIn('uv pip install --python .venv/bin/python "daphne', setup_script)
