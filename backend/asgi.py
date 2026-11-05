"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""



import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

# [ahmed] Select WebSocket authentication through the central adapter.
from realtime.authentication import get_websocket_auth_stack

from realtime.routing import websocket_urlpatterns


application = ProtocolTypeRouter({
    "http": django_asgi_app,

    # [ahmed] Preserve origin validation for browser WebSockets.
    "websocket": AllowedHostsOriginValidator(
        get_websocket_auth_stack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
