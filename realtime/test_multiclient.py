import asyncio
from types import SimpleNamespace
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.middleware import BaseMiddleware
from channels.testing import WebsocketCommunicator
from django.test import SimpleTestCase, override_settings

from realtime.consumers import CalendarConsumer


async def no_database_connection_cleanup():
    """Consumer tests do not open a database connection that needs closing."""


class ControlledAuthenticationMiddleware(BaseMiddleware):
    """Give consumer tests an authenticated scope without testing middleware."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        headers = dict(scope.get('headers', []))
        user_id = headers.get(b'x-test-user-id')

        scope['user'] = SimpleNamespace(
            id=int(user_id) if user_id is not None else None,
            is_authenticated=user_id is not None,
            is_active=headers.get(b'x-test-inactive') is None,
        )
        expiration = headers.get(b'x-test-jwt-exp')
        scope['jwt_exp'] = (
            int(expiration) if expiration is not None else None
        )
        return await super().__call__(scope, receive, send)


@override_settings(
    CHANNEL_LAYERS={
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    },
)
class MultiClientCalendarReliabilityTests(SimpleTestCase):
    group_name = CalendarConsumer.group_name

    def setUp(self):
        for target in (
            'channels.consumer.aclose_old_connections',
            'channels.generic.websocket.aclose_old_connections',
        ):
            cleanup_patch = patch(
                target,
                new=no_database_connection_cleanup,
            )
            cleanup_patch.start()
            self.addCleanup(cleanup_patch.stop)

    async def connect_client(self, user_id, *, jwt_exp=None):
        self.assertEqual(
            get_channel_layer().__class__.__name__,
            'InMemoryChannelLayer',
        )
        headers = [(b'x-test-user-id', str(user_id).encode())]
        if jwt_exp is not None:
            headers.append((b'x-test-jwt-exp', str(jwt_exp).encode()))

        client = WebsocketCommunicator(
            ControlledAuthenticationMiddleware(CalendarConsumer()),
            '/ws/calendar/',
            headers=headers,
        )
        connected, _ = await client.connect(timeout=1)
        self.assertTrue(connected)
        self.assertEqual(
            await client.receive_json_from(timeout=1),
            {
                'type': 'connection_established',
                'message': 'Subscribed to calendar updates',
            },
        )
        return client

    async def broadcast(self, payload):
        await get_channel_layer().group_send(
            self.group_name,
            {
                'type': 'calendar.broadcast',
                'data': payload,
            },
        )

    async def disconnect_clients(self, clients):
        for client in clients:
            if not client.future.done():
                await client.disconnect(timeout=1)

    def group_members(self):
        return set(
            get_channel_layer().groups.get(self.group_name, {})
        )

    def test_three_independent_clients_receive_once_and_in_order(self):
        async_to_sync(self.check_three_clients_receive_once_and_in_order)()

    async def check_three_clients_receive_once_and_in_order(self):
        clients = []
        payloads = [
            {
                'type': 'event_updated',
                'data': {'id': 1, 'name': 'Example Event'},
            },
            {
                'type': 'event_updated',
                'data': {'id': 1, 'name': 'Renamed Event'},
            },
            {
                'type': 'event_deleted',
                'data': {'id': 1},
            },
        ]

        try:
            clients = [
                await self.connect_client(user_id)
                for user_id in (101, 102, 103)
            ]
            self.assertEqual(len(self.group_members()), 3)

            for payload in payloads:
                await self.broadcast(payload)

            for client in clients:
                messages = [
                    await client.receive_json_from(timeout=1)
                    for _ in payloads
                ]
                self.assertEqual(messages, payloads)
                self.assertTrue(await client.receive_nothing(timeout=0.05))
        finally:
            await self.disconnect_clients(clients)

        self.assertFalse(self.group_members())

    def test_disconnect_is_isolated_and_removes_only_that_subscription(self):
        async_to_sync(self.check_disconnect_is_isolated)()

    async def check_disconnect_is_isolated(self):
        clients = [
            await self.connect_client(user_id)
            for user_id in (201, 202, 203)
        ]
        client_a, client_b, client_c = clients

        try:
            members_before = self.group_members()
            self.assertEqual(len(members_before), 3)

            await client_a.disconnect(timeout=1)
            members_after = self.group_members()
            self.assertEqual(len(members_after), 2)
            self.assertEqual(len(members_before - members_after), 1)

            payload = {
                'type': 'event_updated',
                'data': {'id': 2, 'name': 'Still Connected'},
            }
            await self.broadcast(payload)
            self.assertEqual(
                await client_b.receive_json_from(timeout=1),
                payload,
            )
            self.assertEqual(
                await client_c.receive_json_from(timeout=1),
                payload,
            )
            self.assertTrue(await client_a.receive_nothing(timeout=0.05))
        finally:
            await self.disconnect_clients(clients)

        self.assertFalse(self.group_members())

    def test_late_joiner_receives_only_subsequent_events(self):
        async_to_sync(self.check_late_joiner)()

    async def check_late_joiner(self):
        clients = []
        try:
            client_a = await self.connect_client(301)
            client_b = await self.connect_client(302)
            clients.extend((client_a, client_b))

            first = {
                'type': 'event_updated',
                'data': {'id': 3, 'name': 'Before Join'},
            }
            await self.broadcast(first)
            for client in clients:
                self.assertEqual(
                    await client.receive_json_from(timeout=1),
                    first,
                )

            client_c = await self.connect_client(303)
            clients.append(client_c)
            self.assertTrue(await client_c.receive_nothing(timeout=0.05))

            second = {
                'type': 'event_updated',
                'data': {'id': 3, 'name': 'After Join'},
            }
            await self.broadcast(second)
            for client in clients:
                self.assertEqual(
                    await client.receive_json_from(timeout=1),
                    second,
                )
        finally:
            await self.disconnect_clients(clients)

        self.assertFalse(self.group_members())

    def test_reconnect_creates_a_fresh_working_subscription(self):
        async_to_sync(self.check_reconnect)()

    async def check_reconnect(self):
        first_client = await self.connect_client(401)
        old_channel = self.group_members().pop()
        await first_client.disconnect(timeout=1)
        self.assertFalse(self.group_members())

        second_client = await self.connect_client(401)
        try:
            new_channel = self.group_members().pop()
            self.assertNotEqual(new_channel, old_channel)

            payload = {
                'type': 'event_updated',
                'data': {'id': 4, 'name': 'Fresh Subscription'},
            }
            await self.broadcast(payload)
            self.assertEqual(
                await second_client.receive_json_from(timeout=1),
                payload,
            )
        finally:
            await self.disconnect_clients([second_client])

        self.assertFalse(self.group_members())

    def test_rejected_connection_never_joins_the_group(self):
        async_to_sync(self.check_rejected_connection)()

    async def check_rejected_connection(self):
        valid_client = await self.connect_client(501)
        rejected_client = WebsocketCommunicator(
            ControlledAuthenticationMiddleware(CalendarConsumer()),
            '/ws/calendar/',
        )

        try:
            members_before = self.group_members()
            connected, close_code = await rejected_client.connect(timeout=1)
            self.assertFalse(connected)
            self.assertEqual(close_code, 4401)
            self.assertEqual(self.group_members(), members_before)

            payload = {
                'type': 'event_updated',
                'data': {'id': 5, 'name': 'Authorized Only'},
            }
            await self.broadcast(payload)
            self.assertEqual(
                await valid_client.receive_json_from(timeout=1),
                payload,
            )
            self.assertTrue(
                await rejected_client.receive_nothing(timeout=0.05)
            )
        finally:
            await self.disconnect_clients([valid_client, rejected_client])

        self.assertFalse(self.group_members())

    def test_one_client_expiry_does_not_interrupt_valid_clients(self):
        async_to_sync(self.check_one_client_expiry_is_isolated)()

    async def check_one_client_expiry_is_isolated(self):
        expiration = 10_000
        now = [expiration - 60]
        timer_started = asyncio.Event()
        valid_timers_started = asyncio.Event()
        valid_timer_count = 0
        release_timer = asyncio.Event()
        hold_valid_timers = asyncio.Event()
        clients = []

        async def controlled_sleep(delay):
            nonlocal valid_timer_count
            if delay == 60:
                timer_started.set()
                await release_timer.wait()
                return
            self.assertEqual(delay, 120)
            valid_timer_count += 1
            if valid_timer_count == 2:
                valid_timers_started.set()
            await hold_valid_timers.wait()

        with patch(
            'realtime.consumers.time',
            side_effect=lambda: now[0],
        ), patch(
            'realtime.consumers.sleep',
            side_effect=controlled_sleep,
        ):
            try:
                expiring = await self.connect_client(601, jwt_exp=expiration)
                valid_b = await self.connect_client(
                    602,
                    jwt_exp=expiration + 60,
                )
                valid_c = await self.connect_client(
                    603,
                    jwt_exp=expiration + 60,
                )
                clients.extend((expiring, valid_b, valid_c))
                await asyncio.wait_for(timer_started.wait(), timeout=1)
                await asyncio.wait_for(
                    valid_timers_started.wait(),
                    timeout=1,
                )
                self.assertEqual(len(self.group_members()), 3)

                now[0] = expiration
                release_timer.set()
                self.assertEqual(
                    await expiring.receive_output(timeout=1),
                    {'type': 'websocket.close', 'code': 4401},
                )
                self.assertEqual(len(self.group_members()), 2)
                self.assertFalse(valid_b.future.done())
                self.assertFalse(valid_c.future.done())

                payload = {
                    'type': 'event_updated',
                    'data': {'id': 6, 'name': 'Valid Clients Continue'},
                }
                await self.broadcast(payload)
                for client in (valid_b, valid_c):
                    self.assertEqual(
                        await client.receive_json_from(timeout=1),
                        payload,
                    )
                self.assertTrue(
                    await expiring.receive_nothing(timeout=0.05)
                )
            finally:
                await self.disconnect_clients(clients)

        self.assertFalse(self.group_members())
        self.assertTrue(expiring.future.done())

    def test_repeated_connect_disconnect_cycles_leave_no_group_members(self):
        async_to_sync(self.check_repeated_cleanup)()

    async def check_repeated_cleanup(self):
        completed_clients = []

        for user_id in range(701, 706):
            client = await self.connect_client(user_id)
            self.assertEqual(len(self.group_members()), 1)
            await client.disconnect(timeout=1)
            completed_clients.append(client)
            self.assertFalse(self.group_members())

        self.assertTrue(
            all(client.future.done() for client in completed_clients)
        )
        current_task = asyncio.current_task()
        unfinished_tasks = {
            task
            for task in asyncio.all_tasks()
            if task is not current_task and not task.done()
        }
        self.assertFalse(unfinished_tasks)
