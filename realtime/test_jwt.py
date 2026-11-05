import asyncio
from datetime import timedelta
from unittest.mock import patch

import jwt
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from realtime.authentication import get_websocket_auth_stack
from realtime.consumers import CalendarConsumer
from realtime.routing import websocket_urlpatterns


@override_settings(
    WS_AUTH_BACKEND="jwt",
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    },
)
class JWTWebSocketTests(TransactionTestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="jwt_student",
            password="test_password",
        )

    async def connect_with_token(self, token=None, headers=None, origin=None,
                                 path="/ws/calendar/", include_origin=True):
        headers = list(headers or [])

        if token is not None:
            headers.append((
                b"cookie",
                f"ws_access={token}".encode(),
            ))

        if include_origin:
            headers.append((b"origin", (origin or "https://localhost").encode()))
        application = AllowedHostsOriginValidator(
            get_websocket_auth_stack(URLRouter(websocket_urlpatterns))
        )

        client = WebsocketCommunicator(
            application,
            path,
            headers=headers,
        )

        connected, _ = await client.connect()
        return client, connected

    def test_valid_jwt_connects(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self.check_valid_token)(token)

    def test_other_cookies_do_not_prevent_authentication(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self.check_valid_token)(token, headers=[
            (b"cookie", f"theme=dark; ws_access={token}; language=en".encode())
        ])

    async def check_valid_token(self, token, **kwargs):
        if "headers" in kwargs:
            token = None
        client, connected = await self.connect_with_token(token, **kwargs)

        try:
            self.assertTrue(connected)
            response = await client.receive_json_from()
            self.assertEqual(
                response["type"],
                "connection_established",
            )
        finally:
            if connected:
                await client.disconnect()

    def test_invalid_jwt_is_rejected(self):
        async_to_sync(self.check_rejected_token)("invalid.jwt.token")

    def test_missing_jwt_is_rejected(self):
        async_to_sync(self.check_rejected_token)(None)

    def test_expired_jwt_is_rejected(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=-30))
        async_to_sync(self.check_rejected_token)(str(token))

    def test_inactive_user_is_rejected(self):
        token = str(AccessToken.for_user(self.user))
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        async_to_sync(self.check_rejected_token)(token)

    async def check_rejected_token(self, token=None, **kwargs):
        client, connected = await self.connect_with_token(token, **kwargs)
        try:
            self.assertFalse(connected)
        finally:
            await client.disconnect()

    def test_refresh_token_is_rejected(self):
        async_to_sync(self.check_rejected_token)(
            str(RefreshToken.for_user(self.user))
        )

    @override_settings(SIMPLE_JWT={"AUTH_TOKEN_CLASSES": (
        "rest_framework_simplejwt.tokens.AccessToken",
        "rest_framework_simplejwt.tokens.RefreshToken",
    )})
    def test_refresh_rejected_even_if_api_accepts_it(self):
        async_to_sync(self.check_rejected_token)(
            str(RefreshToken.for_user(self.user))
        )

    def test_deleted_user_is_rejected(self):
        token = str(AccessToken.for_user(self.user))
        self.user.delete()
        async_to_sync(self.check_rejected_token)(token)

    def test_missing_user_claim_is_rejected(self):
        token = AccessToken.for_user(self.user)
        del token["user_id"]
        async_to_sync(self.check_rejected_token)(str(token))

    def test_malformed_user_claim_is_rejected(self):
        for value in ("not-an-id", [], {}, None):
            with self.subTest(value=value):
                token = AccessToken.for_user(self.user)
                token["user_id"] = value
                async_to_sync(self.check_rejected_token)(str(token))

    def test_invalid_signature_is_rejected(self):
        token = AccessToken.for_user(self.user)
        encoded = jwt.encode(token.payload, "test-only-untrusted-key-" * 3,
                             algorithm="HS256")
        async_to_sync(self.check_rejected_token)(encoded)

    def test_duplicate_and_malformed_cookies_are_rejected(self):
        token = str(AccessToken.for_user(self.user))
        for value in (
            f"ws_access=invalid; ws_access={token}",
            f"ws_access={token}; ws_access=invalid",
            f"ws_access={token}; ws_access={token}",
            f"broken; ws_access={token}",
            f"ws_access={token}; bad=\"unterminated",
            "ws_access=",
        ):
            with self.subTest(cookie_shape=value.split("=")[0]):
                async_to_sync(self.check_rejected_token)(
                    headers=[(b"cookie", value.encode())]
                )

    def test_multiple_cookie_headers_are_rejected(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self.check_rejected_token)(headers=[
            (b"cookie", f"ws_access={token}".encode()),
            (b"cookie", b"theme=dark"),
        ])

    @override_settings(ALLOWED_HOSTS=["localhost"], DEBUG=False)
    def test_wrong_origin_is_rejected(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self.check_rejected_token)(
            token, origin="https://untrusted.example"
        )

    @override_settings(ALLOWED_HOSTS=["localhost"], DEBUG=False)
    def test_missing_origin_is_rejected(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self.check_rejected_token)(token, include_origin=False)

    def test_query_token_does_not_authenticate(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self.check_rejected_token)(
            path=f"/ws/calendar/?token={token}"
        )

    def test_configured_issuer_and_audience(self):
        backend = TokenBackend(
            algorithm="HS256", signing_key="test-only-signing-key-" * 3,
            issuer="campus-test", audience="calendar-test",
        )
        token = AccessToken.for_user(self.user)
        valid = backend.encode(token.payload)
        with patch.object(AccessToken, "get_token_backend", return_value=backend):
            async_to_sync(self.check_valid_token)(valid)
            for claim in ("iss", "aud"):
                payload = jwt.decode(valid, options={"verify_signature": False})
                payload[claim] = "wrong-value"
                invalid = jwt.encode(payload, "test-only-signing-key-" * 3,
                                     algorithm="HS256")
                async_to_sync(self.check_rejected_token)(invalid)

    def test_jwt_expiration_closes_connection_and_removes_group(self):
        token = AccessToken.for_user(self.user)
        async_to_sync(self.check_connection_lifecycle)(token, "expiry")

    def test_normal_disconnect_cancels_expiration_task(self):
        token = AccessToken.for_user(self.user)
        async_to_sync(self.check_connection_lifecycle)(token, "disconnect")

    def test_expired_connection_does_not_forward_queued_broadcast(self):
        token = AccessToken.for_user(self.user)
        async_to_sync(self.check_connection_lifecycle)(token, "broadcast")

    async def check_connection_lifecycle(self, token, action):
        consumer = CalendarConsumer()
        started = asyncio.Event()
        release = asyncio.Event()
        now = [token["exp"] - 60]

        async def controlled_sleep(delay):
            self.assertEqual(delay, 60)
            started.set()
            await release.wait()

        application = get_websocket_auth_stack(consumer)
        client = WebsocketCommunicator(application, "/ws/calendar/", headers=[
            (b"cookie", f"ws_access={token}".encode()),
        ])
        layer = get_channel_layer()
        with patch("realtime.consumers.time", side_effect=lambda: now[0]), \
                patch("realtime.consumers.sleep", side_effect=controlled_sleep), \
                patch.object(layer, "group_discard", wraps=layer.group_discard) as discard:
            try:
                connected, _ = await client.connect()
                self.assertTrue(connected)
                welcome = await client.receive_json_from()
                self.assertEqual(welcome["type"], "connection_established")
                await asyncio.wait_for(started.wait(), timeout=1)
                task = consumer.expiration_task
                self.assertFalse(task.done())
                self.assertEqual(consumer.scope["jwt_exp"], token["exp"])
                self.assertIn(consumer.channel_name, layer.groups["calendar_updates"])
                if action != "disconnect":
                    now[0] = token["exp"]
                    if action == "expiry":
                        release.set()
                    else:
                        await layer.group_send("calendar_updates", {
                            "type": "calendar.broadcast",
                            "data": {"type": "event_created", "data": {"id": 1}},
                        })
                    self.assertEqual(await client.receive_output(), {
                        "type": "websocket.close", "code": 4401,
                    })
                    self.assertFalse(consumer.joined_group)
                    self.assertNotIn(consumer.channel_name,
                                     layer.groups.get("calendar_updates", {}))
            finally:
                await client.disconnect()
            self.assertTrue(task.done())
            if action != "expiry":
                self.assertTrue(task.cancelled())
            self.assertIsNone(consumer.expiration_task)
            self.assertFalse(consumer.joined_group)
            self.assertNotIn(consumer.channel_name,
                             layer.groups.get("calendar_updates", {}))
            discard.assert_awaited_once_with("calendar_updates", consumer.channel_name)

    def test_expiry_between_accept_and_timer_uses_zero_delay(self):
        token = AccessToken.for_user(self.user)
        async_to_sync(self.check_zero_delay_expiry)(token)

    async def check_zero_delay_expiry(self, token):
        consumer = CalendarConsumer()
        client = WebsocketCommunicator(
            get_websocket_auth_stack(consumer), "/ws/calendar/", headers=[
                (b"cookie", f"ws_access={token}".encode()),
            ],
        )
        with patch("realtime.consumers.time", side_effect=[
            token["exp"] - 1, token["exp"] + 1,
        ]), patch("realtime.consumers.sleep") as timer:
            try:
                connected, _ = await client.connect()
                self.assertTrue(connected)
                await client.receive_json_from()
                self.assertEqual(await client.receive_output(), {
                    "type": "websocket.close", "code": 4401,
                })
                timer.assert_awaited_once_with(0)
                self.assertFalse(consumer.joined_group)
            finally:
                await client.disconnect()
            self.assertIsNone(consumer.expiration_task)

    def test_jwt_expiring_during_handshake_is_rejected(self):
        token = AccessToken.for_user(self.user)
        with patch("realtime.consumers.time", return_value=token["exp"]):
            async_to_sync(self.check_rejected_token)(str(token))

    @override_settings(WS_AUTH_BACKEND="token_dev", DEBUG=True)
    def test_development_token_connection_has_no_expiration_task(self):
        token = Token.objects.create(user=self.user)
        async_to_sync(self.check_development_connection)(token.key)

    async def check_development_connection(self, token):
        consumer = CalendarConsumer()
        client = WebsocketCommunicator(
            get_websocket_auth_stack(consumer), f"/ws/calendar/?token={token}"
        )
        with patch("realtime.consumers.sleep") as timer:
            try:
                connected, _ = await client.connect()
                self.assertTrue(connected)
                await client.receive_json_from()
                self.assertIsNone(consumer.expiration_task)
                await get_channel_layer().group_send("calendar_updates", {
                    "type": "calendar.broadcast", "data": {"type": "event_updated"},
                })
                self.assertEqual(await client.receive_json_from(), {"type": "event_updated"})
                timer.assert_not_called()
            finally:
                await client.disconnect()
            self.assertFalse(consumer.joined_group)
            self.assertIsNone(consumer.expiration_task)

    def test_malformed_expiry_is_rejected(self):
        for expiration in (None, "9999999999", True, 9999999999.0):
            with self.subTest(expiration=expiration):
                token = AccessToken.for_user(self.user)
                token["exp"] = expiration
                async_to_sync(self.check_rejected_token)(str(token))

    def test_jwt_clients_receive_broadcast(self):
        async_to_sync(self.check_broadcast)(str(AccessToken.for_user(self.user)))

    async def check_broadcast(self, token):
        clients = []
        try:
            for _ in range(2):
                client, connected = await self.connect_with_token(token)
                clients.append(client)
                self.assertTrue(connected)
                await client.receive_json_from()
            payload = {"type": "event_created", "data": {"id": 1}}
            await get_channel_layer().group_send("calendar_updates", {
                "type": "calendar.broadcast", "data": payload,
            })
            for client in clients:
                self.assertEqual(await client.receive_json_from(), payload)
        finally:
            for client in clients:
                await client.disconnect()


class WebSocketAuthConfigurationTests(SimpleTestCase):
    @override_settings(WS_AUTH_BACKEND="unsupported")
    def test_unknown_backend_fails_closed(self):
        with self.assertRaises(ImproperlyConfigured):
            get_websocket_auth_stack(None)

    @override_settings(WS_AUTH_BACKEND="token_dev", DEBUG=False)
    def test_development_tokens_forbidden_in_production(self):
        with self.assertRaises(ImproperlyConfigured):
            get_websocket_auth_stack(None)
