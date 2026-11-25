from django.urls import re_path
from .consumers import CalendarConsumer, NotificationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/calendar/$", CalendarConsumer.as_asgi()),
    re_path(r"^ws/notifications/$", NotificationConsumer.as_asgi()),
]
