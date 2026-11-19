import json
from channels.generic.websocket import AsyncWebsocketConsumer


class HealthConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({
            "status": "ok",
            "message": "WebSocket connected"
        }))

    async def disconnect(self, close_code):
        pass