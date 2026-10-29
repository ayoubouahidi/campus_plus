
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class CalendarConsumer(AsyncJsonWebsocketConsumer):

    group_name = "calendar_updates"

    async def connect(self):
        # [Member 3] Retrieve the user identified by the middleware.
        user = self.scope.get("user")

        # [Member 3] Reject anonymous or inactive users.
        if (
            user is None
            or not user.is_authenticated
            or not user.is_active
        ):
            await self.close(code=4401)
            return

        # [Member 3] Subscribe authenticated users to calendar updates.
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send_json({
            "type": "connection_established",
            "message": "Subscribed to calendar updates",
        })

    async def disconnect(self, close_code):
        # [Member 3] Unsubscribe only accepted connections.
        user = self.scope.get("user")

        if user is not None and user.is_authenticated and user.is_active:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def calendar_broadcast(self, event):
        await self.send_json(event["data"])
