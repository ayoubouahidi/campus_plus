import asyncio
from asyncio import sleep
from contextlib import suppress
from time import time

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class CalendarConsumer(AsyncJsonWebsocketConsumer):

    group_name = "calendar_updates"

    async def connect(self):
        # [ahmed] Track whether this connection joined the group.
        self.joined_group = False
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
        await self.channel_layer.send(self.channel_name, {"type": "jwt.expired"})

    # [ahmed] Stop subscription delivery immediately when the credential expires.
    async def jwt_expired(self, event):
        if not self.joined_group:
            return
        await self.leave_calendar_group()
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
            if task is not None:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        finally:
            self.expiration_task = None
            await self.leave_calendar_group()

    async def calendar_broadcast(self, event):
        if not self.joined_group:
            return
        # [ahmed] Queued broadcasts must not bypass a delayed expiry notification.
        if self.jwt_exp is not None and self.jwt_exp <= time():
            await self.jwt_expired({"type": "jwt.expired"})
            return
        await self.send_json(event["data"])
