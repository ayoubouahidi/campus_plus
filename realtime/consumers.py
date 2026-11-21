import asyncio
import logging
from asyncio import sleep
from contextlib import suppress
from time import time

from channels.generic.websocket import AsyncJsonWebsocketConsumer


logger = logging.getLogger(__name__)


class CalendarConsumer(AsyncJsonWebsocketConsumer):

    group_name = "calendar_updates"
    expiry_channel_timeout = 1
    expiry_cleanup_timeout = 1

    async def connect(self):
        # [ahmed] Track whether this connection joined the group.
        self.joined_group = False
        self.expired = False
        self.expiration_cleanup_started = False
        # [ahmed] Development-token connections have no JWT deadline or timer.
        self.expiration_task = None
        self.jwt_exp = self.scope.get("jwt_exp")

        # [ahmed] Get the authenticated user.
        user = self.scope.get("user")

        # [ahmed] Reject anonymous or inactive users.
        if (
            user is None
            or not user.is_authenticated
            or not user.is_active
        ):
            await self.close(code=4401)
            return

        # [ahmed] Verification may finish just before expiry; recheck before joining.
        if self.jwt_exp is not None and self.jwt_exp <= time():
            await self.close(code=4401)
            return

        # [ahmed] Subscribe to calendar broadcasts.
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        # [ahmed] Remember that subscription succeeded.
        self.joined_group = True

        await self.accept()

        await self.send_json({
            "type": "connection_established",
            "message": "Subscribed to calendar updates",
        })

        # [ahmed] Keep expiry delivery in the consumer's serialized event stream.
        if self.jwt_exp is not None:
            self.expiration_task = asyncio.create_task(self.wait_for_jwt_expiry())

    # [ahmed] Sleep without blocking other connections, then notify this consumer.
    async def wait_for_jwt_expiry(self):
        await sleep(max(0, self.jwt_exp - time()))
        # [ahmed] Revoke locally before any Redis operation can fail or stall.
        self.expired = True
        try:
            await asyncio.wait_for(
                self.channel_layer.send(
                    self.channel_name,
                    {"type": "jwt.expired"},
                ),
                timeout=self.expiry_channel_timeout,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "JWT expiry notification failed; closing connection locally"
            )
            await self.expire_connection()

    # [ahmed] Stop subscription delivery immediately when the credential expires.
    async def jwt_expired(self, event):
        await self.expire_connection()

    # [ahmed] Fail closed once, even if Redis cleanup fails or stalls.
    async def expire_connection(self):
        self.expired = True
        if getattr(self, "expiration_cleanup_started", False):
            return
        self.expiration_cleanup_started = True

        joined_group = getattr(self, "joined_group", False)
        self.joined_group = False
        try:
            if joined_group:
                try:
                    await asyncio.wait_for(
                        self.channel_layer.group_discard(
                            self.group_name,
                            self.channel_name,
                        ),
                        timeout=self.expiry_cleanup_timeout,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception(
                        "Expired WebSocket group cleanup failed"
                    )
        finally:
            await self.close(code=4401)

    # [ahmed] Share idempotent group cleanup between expiry and normal disconnect.
    async def leave_calendar_group(self):
        if getattr(self, "joined_group", False):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )
            self.joined_group = False

    async def disconnect(self, close_code):
        # [ahmed] Await cancellation so no timer outlives a disconnected socket.
        task = getattr(self, "expiration_task", None)
        try:
            if task is not None and task is not asyncio.current_task():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        finally:
            self.expiration_task = None
            await self.leave_calendar_group()

    async def calendar_broadcast(self, event):
        if getattr(self, "expired", False) or not self.joined_group:
            return
        # [ahmed] Queued broadcasts must not bypass a delayed expiry notification.
        if self.jwt_exp is not None and self.jwt_exp <= time():
            await self.expire_connection()
            return
        await self.send_json(event["data"])
