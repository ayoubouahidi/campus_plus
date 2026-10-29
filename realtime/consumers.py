
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class CalendarConsumer(AsyncJsonWebsocketConsumer):

    group_name = "calendar_updates"

    async def connect(self):
        # [ahmed] Track whether this connection joined the group.
        self.joined_group = False

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

    async def disconnect(self, close_code):
        # [ahmed] Remove only connections that joined the group.
        if getattr(self, "joined_group", False):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def calendar_broadcast(self, event):
        await self.send_json(event["data"])
