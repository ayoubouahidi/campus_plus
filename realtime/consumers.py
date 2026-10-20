from channels.generic.websocket import AsyncJsonWebsocketConsumer


class CalendarConsumer(AsyncJsonWebsocketConsumer):

    group_name = "calendar_updates"

    async def connect(self):

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

        await self.send_json({
            "type": "connection_established",
            "message": "Subscribed to calendar updates"
        })

    async def disconnect(self, close_code):

        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def calendar_broadcast(self, event):

        await self.send_json(event["data"])
