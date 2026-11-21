import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.middleware import BaseMiddleware
from channels.testing import WebsocketCommunicator
from django.db import transaction
from django.test import SimpleTestCase, TransactionTestCase, override_settings

from core_data.views import ClubEventViewSet
from realtime.broadcast import broadcast_calendar_event
from realtime.consumers import CalendarConsumer


async def no_database_connection_cleanup():
    """These synthetic consumer tests perform no database access."""


class ResilienceAuthenticationMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        headers = dict(scope.get("headers", []))
        scope["user"] = SimpleNamespace(
            id=9001,
            is_authenticated=True,
            is_active=True,
        )
        scope["jwt_exp"] = int(headers.get(b"x-test-jwt-exp", b"10000"))
        return await super().__call__(scope, receive, send)


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    },
)
class ConsumerFailureCleanupTests(SimpleTestCase):
    def setUp(self):
        for target in (
            "channels.consumer.aclose_old_connections",
            "channels.generic.websocket.aclose_old_connections",
        ):
            cleanup_patch = patch(
                target,
                new=no_database_connection_cleanup,
            )
            cleanup_patch.start()
            self.addCleanup(cleanup_patch.stop)

    def test_abrupt_disconnect_removes_membership_and_cancels_expiry_task(self):
        async_to_sync(self.check_abrupt_disconnect_cleanup)()

    async def check_abrupt_disconnect_cleanup(self):
        consumer = CalendarConsumer()
        client = WebsocketCommunicator(
            ResilienceAuthenticationMiddleware(consumer),
            "/ws/calendar/",
        )
        layer = get_channel_layer()
        now = [9_900]
        timer_started = asyncio.Event()

        async def held_timer(delay):
            self.assertEqual(delay, 100)
            timer_started.set()
            await asyncio.Event().wait()

        with patch(
            "realtime.consumers.time",
            side_effect=lambda: now[0],
        ), patch(
            "realtime.consumers.sleep",
            side_effect=held_timer,
        ):
            connected, _ = await client.connect(timeout=1)
            self.assertTrue(connected)
            self.assertEqual(
                (await client.receive_json_from(timeout=1))["type"],
                "connection_established",
            )
            await asyncio.wait_for(timer_started.wait(), timeout=1)
            expiration_task = consumer.expiration_task
            self.assertIn(
                consumer.channel_name,
                layer.groups[CalendarConsumer.group_name],
            )

            # Code 1006 represents an abnormal transport loss rather than a
            # graceful client close handshake.
            await client.send_input({
                "type": "websocket.disconnect",
                "code": 1006,
            })
            await asyncio.wait_for(client.future, timeout=1)

        self.assertTrue(expiration_task.done())
        self.assertTrue(expiration_task.cancelled())
        self.assertIsNone(consumer.expiration_task)
        self.assertFalse(consumer.joined_group)
        self.assertNotIn(
            consumer.channel_name,
            layer.groups.get(CalendarConsumer.group_name, {}),
        )


class BroadcastFailureBoundaryTests(SimpleTestCase):
    def test_channel_layer_error_propagates_and_next_broadcast_can_recover(self):
        layer = SimpleNamespace(
            group_send=AsyncMock(
                side_effect=[ConnectionError("temporary channel failure"), None]
            )
        )
        payload = {"id": 17, "name": "Resilience Probe"}

        with patch("realtime.broadcast.get_channel_layer", return_value=layer):
            with self.assertRaisesRegex(
                ConnectionError,
                "temporary channel failure",
            ):
                broadcast_calendar_event("event_updated", payload)

            broadcast_calendar_event("event_updated", payload)

        self.assertEqual(layer.group_send.await_count, 2)
        layer.group_send.assert_awaited_with(
            "calendar_updates",
            {
                "type": "calendar.broadcast",
                "data": {
                    "type": "event_updated",
                    "data": payload,
                },
            },
        )

    def test_successful_broadcast_uses_the_existing_message_contract(self):
        layer = SimpleNamespace(group_send=AsyncMock())
        payload = {"id": 23}

        with patch("realtime.broadcast.get_channel_layer", return_value=layer):
            broadcast_calendar_event("event_deleted", payload)

        layer.group_send.assert_awaited_once_with(
            "calendar_updates",
            {
                "type": "calendar.broadcast",
                "data": {
                    "type": "event_deleted",
                    "data": payload,
                },
            },
        )


class BestEffortEventBroadcastRegistrationTests(SimpleTestCase):
    def capture_callback(self, operation):
        callbacks = []

        def capture_on_commit(callback, *, robust=False):
            callbacks.append((callback, robust))

        with patch(
            "core_data.views.transaction.on_commit",
            side_effect=capture_on_commit,
        ):
            operation()

        self.assertEqual(len(callbacks), 1)
        callback, robust = callbacks[0]
        self.assertTrue(robust)
        return callback

    @patch("core_data.views.broadcast_calendar_event")
    def test_create_saves_once_and_registers_one_robust_callback(self, broadcast):
        serializer = Mock()
        serializer.data = {"id": 31, "name": "Created event"}
        callback = self.capture_callback(
            lambda: ClubEventViewSet().perform_create(serializer)
        )

        serializer.save.assert_called_once_with()
        broadcast.assert_not_called()
        callback()
        broadcast.assert_called_once_with(
            "event_created",
            {"id": 31, "name": "Created event"},
        )

    @patch("core_data.views.broadcast_calendar_event")
    def test_update_saves_once_and_registers_one_robust_callback(self, broadcast):
        serializer = Mock()
        serializer.data = {"id": 32, "location": "Updated hall"}
        callback = self.capture_callback(
            lambda: ClubEventViewSet().perform_update(serializer)
        )

        serializer.save.assert_called_once_with()
        broadcast.assert_not_called()
        callback()
        broadcast.assert_called_once_with(
            "event_updated",
            {"id": 32, "location": "Updated hall"},
        )

    @patch("core_data.views.broadcast_calendar_event")
    def test_delete_runs_once_and_registers_one_robust_callback(self, broadcast):
        instance = Mock(pk=33)
        callback = self.capture_callback(
            lambda: ClubEventViewSet().perform_destroy(instance)
        )

        instance.delete.assert_called_once_with()
        broadcast.assert_not_called()
        callback()
        broadcast.assert_called_once_with("event_deleted", {"id": 33})

    @patch("core_data.views.broadcast_calendar_event")
    def test_uncommitted_callback_does_not_broadcast(self, broadcast):
        serializer = Mock()
        serializer.data = {"id": 34}

        # Capturing without executing models Django discarding the callback on
        # rollback. The view never invokes the notification before commit.
        self.capture_callback(
            lambda: ClubEventViewSet().perform_create(serializer)
        )

        serializer.save.assert_called_once_with()
        broadcast.assert_not_called()

    def test_persistence_error_still_propagates_and_registers_no_callback(self):
        serializer = Mock()
        serializer.save.side_effect = ValueError("database write failed")

        with patch("core_data.views.transaction.on_commit") as on_commit:
            with self.assertRaisesRegex(ValueError, "database write failed"):
                ClubEventViewSet().perform_create(serializer)

        on_commit.assert_not_called()


class BestEffortOnCommitTransactionTests(TransactionTestCase):
    def test_callback_runs_only_after_successful_commit(self):
        callback = Mock()

        with transaction.atomic():
            transaction.on_commit(callback, robust=True)
            callback.assert_not_called()

        callback.assert_called_once_with()

    def test_rolled_back_transaction_never_broadcasts(self):
        callback = Mock()

        with self.assertRaisesRegex(RuntimeError, "force rollback"):
            with transaction.atomic():
                transaction.on_commit(callback, robust=True)
                raise RuntimeError("force rollback")

        callback.assert_not_called()

    def test_connection_and_timeout_errors_are_logged_after_commit(self):
        private_event_data = "private-event-data-must-not-be-logged"

        for error in (
            ConnectionError("Redis unavailable"),
            TimeoutError("Redis timed out"),
        ):
            with self.subTest(error=type(error).__name__):
                def failed_broadcast():
                    # The closure models an event callback carrying serialized
                    # data; Django logs its name and exception, not its closure.
                    self.assertTrue(private_event_data)
                    raise error

                with self.assertLogs(
                    "django.db.backends.base",
                    level="ERROR",
                ) as logs:
                    with transaction.atomic():
                        transaction.on_commit(
                            failed_broadcast,
                            robust=True,
                        )

                combined_logs = "\n".join(logs.output)
                self.assertIn(str(error), combined_logs)
                self.assertNotIn(private_event_data, combined_logs)


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    },
)
class ExpiryNotificationFailureTests(SimpleTestCase):
    def setUp(self):
        for target in (
            "channels.consumer.aclose_old_connections",
            "channels.generic.websocket.aclose_old_connections",
        ):
            cleanup_patch = patch(
                target,
                new=no_database_connection_cleanup,
            )
            cleanup_patch.start()
            self.addCleanup(cleanup_patch.stop)

    def make_direct_consumer(self, *, send=None, discard=None):
        consumer = CalendarConsumer()
        consumer.jwt_exp = 10_000
        consumer.channel_name = "specific.a21-expiry-test!channel"
        consumer.group_name = CalendarConsumer.group_name
        consumer.joined_group = True
        consumer.expired = False
        consumer.expiration_cleanup_started = False
        consumer.expiration_task = None
        consumer.expiry_channel_timeout = 0.05
        consumer.expiry_cleanup_timeout = 0.05
        consumer.channel_layer = SimpleNamespace(
            send=send or AsyncMock(),
            group_discard=discard or AsyncMock(),
        )
        consumer.close = AsyncMock()
        return consumer

    def test_successful_expiry_notification_preserves_normal_event_delivery(self):
        async_to_sync(self.check_successful_expiry_notification)()

    async def check_successful_expiry_notification(self):
        consumer = self.make_direct_consumer()

        with patch("realtime.consumers.time", return_value=10_000), patch(
            "realtime.consumers.sleep",
            new=AsyncMock(),
        ):
            await consumer.wait_for_jwt_expiry()

        self.assertTrue(consumer.expired)
        self.assertFalse(consumer.expiration_cleanup_started)
        consumer.channel_layer.send.assert_awaited_once_with(
            consumer.channel_name,
            {"type": "jwt.expired"},
        )
        consumer.channel_layer.group_discard.assert_not_awaited()
        consumer.close.assert_not_awaited()

        # Simulate normal Channels delivery of the successfully queued event.
        await consumer.jwt_expired({"type": "jwt.expired"})
        self.assertTrue(consumer.expiration_cleanup_started)
        self.assertFalse(consumer.joined_group)
        consumer.channel_layer.group_discard.assert_awaited_once_with(
            consumer.group_name,
            consumer.channel_name,
        )
        consumer.close.assert_awaited_once_with(code=4401)

    def test_notification_failure_closes_locally_without_leaking_exception(self):
        async_to_sync(self.check_expiry_send_failure)()

    async def check_expiry_send_failure(self):
        consumer = self.make_direct_consumer(
            send=AsyncMock(side_effect=ConnectionError("Redis unavailable"))
        )

        with patch("realtime.consumers.time", return_value=10_000), patch(
            "realtime.consumers.sleep",
            new=AsyncMock(),
        ), self.assertLogs("realtime.consumers", level="ERROR"):
            await consumer.wait_for_jwt_expiry()

        self.assertTrue(consumer.expired)
        self.assertTrue(consumer.expiration_cleanup_started)
        self.assertFalse(consumer.joined_group)
        consumer.channel_layer.group_discard.assert_awaited_once_with(
            consumer.group_name,
            consumer.channel_name,
        )
        consumer.close.assert_awaited_once_with(code=4401)

    def test_stalled_expiry_notification_times_out_and_closes_locally(self):
        async_to_sync(self.check_stalled_expiry_notification)()

    async def check_stalled_expiry_notification(self):
        notification_started = asyncio.Event()

        async def stalled_notification(channel, message):
            notification_started.set()
            await asyncio.Event().wait()

        consumer = self.make_direct_consumer(
            send=AsyncMock(side_effect=stalled_notification)
        )
        consumer.expiry_channel_timeout = 0.01

        with patch("realtime.consumers.time", return_value=10_000), patch(
            "realtime.consumers.sleep",
            new=AsyncMock(),
        ), self.assertLogs("realtime.consumers", level="ERROR"):
            await asyncio.wait_for(
                consumer.wait_for_jwt_expiry(),
                timeout=0.2,
            )

        self.assertTrue(notification_started.is_set())
        self.assertTrue(consumer.expired)
        self.assertFalse(consumer.joined_group)
        consumer.channel_layer.group_discard.assert_awaited_once()
        consumer.close.assert_awaited_once_with(code=4401)

    def test_notification_and_cleanup_fail_but_close_remains_idempotent(self):
        async_to_sync(self.check_double_redis_failure)()

    async def check_double_redis_failure(self):
        consumer = self.make_direct_consumer(
            send=AsyncMock(side_effect=ConnectionError("send failed")),
            discard=AsyncMock(side_effect=ConnectionError("discard failed")),
        )

        with patch("realtime.consumers.time", return_value=10_000), patch(
            "realtime.consumers.sleep",
            new=AsyncMock(),
        ), self.assertLogs("realtime.consumers", level="ERROR") as logs:
            await consumer.wait_for_jwt_expiry()
            await consumer.expire_connection()

        self.assertEqual(len(logs.output), 2)
        self.assertTrue(consumer.expired)
        self.assertFalse(consumer.joined_group)
        consumer.channel_layer.group_discard.assert_awaited_once()
        consumer.close.assert_awaited_once_with(code=4401)

    def test_stalled_group_cleanup_is_bounded_and_cannot_prevent_close(self):
        async_to_sync(self.check_stalled_group_cleanup)()

    async def check_stalled_group_cleanup(self):
        cleanup_started = asyncio.Event()

        async def stalled_cleanup(group, channel):
            cleanup_started.set()
            await asyncio.Event().wait()

        consumer = self.make_direct_consumer(
            discard=AsyncMock(side_effect=stalled_cleanup)
        )
        consumer.expiry_cleanup_timeout = 0.01

        with self.assertLogs("realtime.consumers", level="ERROR"):
            await asyncio.wait_for(consumer.expire_connection(), timeout=0.2)

        self.assertTrue(cleanup_started.is_set())
        self.assertTrue(consumer.expired)
        self.assertFalse(consumer.joined_group)
        consumer.close.assert_awaited_once_with(code=4401)

    def test_concurrent_expiry_disconnect_cancels_once_without_self_await(self):
        async_to_sync(self.check_concurrent_expiry_disconnect)()

    async def check_concurrent_expiry_disconnect(self):
        cleanup_started = asyncio.Event()

        async def held_cleanup(group, channel):
            cleanup_started.set()
            await asyncio.Event().wait()

        consumer = self.make_direct_consumer(
            discard=AsyncMock(side_effect=held_cleanup)
        )
        expiration_task = asyncio.create_task(consumer.expire_connection())
        consumer.expiration_task = expiration_task
        await asyncio.wait_for(cleanup_started.wait(), timeout=0.2)

        await asyncio.wait_for(consumer.disconnect(1000), timeout=0.2)

        self.assertTrue(expiration_task.cancelled())
        self.assertIsNone(consumer.expiration_task)
        self.assertFalse(consumer.joined_group)
        consumer.channel_layer.group_discard.assert_awaited_once()
        consumer.close.assert_awaited_once_with(code=4401)

        # A defensive identity check prevents disconnect from cancelling or
        # awaiting itself if it is ever invoked by the timer task.
        self_await_consumer = self.make_direct_consumer()
        self_await_consumer.joined_group = False
        self_await_consumer.expiration_task = asyncio.current_task()
        await asyncio.wait_for(
            self_await_consumer.disconnect(1000),
            timeout=0.2,
        )
        self.assertIsNone(self_await_consumer.expiration_task)

    def test_failed_notification_closes_immediately_and_preserves_peer(self):
        async_to_sync(self.check_failed_notification_lifecycle)()

    async def check_failed_notification_lifecycle(self):
        layer = get_channel_layer()
        expiring_consumer = CalendarConsumer()
        peer_consumer = CalendarConsumer()
        expiring_client = WebsocketCommunicator(
            ResilienceAuthenticationMiddleware(expiring_consumer),
            "/ws/calendar/",
            headers=[(b"x-test-jwt-exp", b"10000")],
        )
        peer_client = WebsocketCommunicator(
            ResilienceAuthenticationMiddleware(peer_consumer),
            "/ws/calendar/",
            headers=[(b"x-test-jwt-exp", b"10100")],
        )
        now = [9_900]
        expiring_timer_started = asyncio.Event()
        peer_timer_started = asyncio.Event()
        release_expiring_timer = asyncio.Event()
        hold_peer_timer = asyncio.Event()
        original_send = layer.send

        async def controlled_sleep(delay):
            if delay == 100:
                expiring_timer_started.set()
                await release_expiring_timer.wait()
                return
            self.assertEqual(delay, 200)
            peer_timer_started.set()
            await hold_peer_timer.wait()

        async def selectively_failing_send(channel, message):
            if (
                channel == expiring_consumer.channel_name
                and message == {"type": "jwt.expired"}
            ):
                raise ConnectionError("Redis unavailable at expiry")
            return await original_send(channel, message)

        with patch(
            "realtime.consumers.time",
            side_effect=lambda: now[0],
        ), patch(
            "realtime.consumers.sleep",
            side_effect=controlled_sleep,
        ), patch.object(
            layer,
            "send",
            side_effect=selectively_failing_send,
        ), patch.object(
            layer,
            "group_discard",
            wraps=layer.group_discard,
        ) as discard:
            clients = (expiring_client, peer_client)
            try:
                for client in clients:
                    connected, _ = await client.connect(timeout=1)
                    self.assertTrue(connected)
                    self.assertEqual(
                        (await client.receive_json_from(timeout=1))["type"],
                        "connection_established",
                    )

                await asyncio.wait_for(
                    expiring_timer_started.wait(),
                    timeout=1,
                )
                await asyncio.wait_for(peer_timer_started.wait(), timeout=1)
                expiration_task = expiring_consumer.expiration_task
                peer_timer = peer_consumer.expiration_task

                now[0] = 10_000
                release_expiring_timer.set()
                with self.assertLogs(
                    "realtime.consumers",
                    level="ERROR",
                ):
                    self.assertEqual(
                        await expiring_client.receive_output(timeout=1),
                        {"type": "websocket.close", "code": 4401},
                    )
                    await asyncio.wait_for(expiration_task, timeout=1)

                # Fail closed before any later broadcast is required.
                self.assertTrue(expiring_consumer.expired)
                self.assertFalse(expiring_consumer.joined_group)
                self.assertNotIn(
                    expiring_consumer.channel_name,
                    layer.groups.get(CalendarConsumer.group_name, {}),
                )

                payload = {
                    "type": "event_updated",
                    "data": {"id": 71, "name": "Peer remains active"},
                }
                await layer.group_send(
                    CalendarConsumer.group_name,
                    {
                        "type": "calendar.broadcast",
                        "data": payload,
                    },
                )

                self.assertEqual(
                    await peer_client.receive_json_from(timeout=1),
                    payload,
                )
                self.assertTrue(
                    await expiring_client.receive_nothing(timeout=0.05)
                )
                self.assertFalse(peer_timer.done())
                discard.assert_any_await(
                    CalendarConsumer.group_name,
                    expiring_consumer.channel_name,
                )
            finally:
                for client in clients:
                    if not client.future.done():
                        await client.disconnect(timeout=1)
                if not expiring_client.future.done():
                    await expiring_client.wait(timeout=1)

        self.assertTrue(peer_timer.done())
        self.assertTrue(peer_timer.cancelled())
        self.assertIsNone(peer_consumer.expiration_task)
        self.assertTrue(expiration_task.done())
        self.assertIsNone(expiration_task.exception())
        self.assertIsNone(expiring_consumer.expiration_task)
        self.assertTrue(expiring_client.future.done())
        self.assertTrue(peer_client.future.done())
        self.assertFalse(layer.groups.get(CalendarConsumer.group_name, {}))
        current_task = asyncio.current_task()
        unfinished_tasks = {
            task
            for task in asyncio.all_tasks()
            if task is not current_task and not task.done()
        }
        self.assertFalse(unfinished_tasks)
