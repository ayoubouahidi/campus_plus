# [ahmed] WebSocket authentication backend selection and imports.
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from realtime.jwt_middleware import JWTAuthMiddleware
from realtime.middleware import TokenAuthMiddleware


# [ahmed] Choose the appropriate WebSocket authentication backend.
def get_websocket_auth_stack(application):
    method = getattr(settings, "WS_AUTH_BACKEND", "token_dev")

    # [ahmed] Preserve the existing development authentication.
    if method == "token_dev":
        if not settings.DEBUG:
            raise ImproperlyConfigured(
                "token_dev cannot be used when DEBUG=False"
            )

        return TokenAuthMiddleware(application)

    # [ahmed] Enable backend-issued JWT authentication.
    if method == "jwt":
        return JWTAuthMiddleware(application)

    # [ahmed] Fail closed when authentication is misconfigured.
    raise ImproperlyConfigured(
        f"Unsupported WebSocket authentication backend: {method}"
    )
