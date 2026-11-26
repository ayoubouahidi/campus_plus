# [ahmed] JWT cookie verification middleware and imports.
import re
from http.cookies import CookieError, SimpleCookie

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ValidationError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings


# [ahmed] Verify a backend-issued access JWT and return the user and expiry.
@database_sync_to_async
def get_jwt_user(raw_token):
    authentication = JWTAuthentication()

    try:
        validated_token = authentication.get_validated_token(raw_token)
        # [ahmed] Only access tokens may authenticate a WebSocket.
        if validated_token.get(api_settings.TOKEN_TYPE_CLAIM) != "access":
            return AnonymousUser(), None
        # [ahmed] Read the expiry from the cryptographically validated token.
        expiration = validated_token.get("exp")
        if type(expiration) is not int:
            return AnonymousUser(), None
        user = authentication.get_user(validated_token)
        return user, expiration
    except (
        InvalidToken, AuthenticationFailed, ValueError, TypeError,
        ValidationError,
    ):
        return AnonymousUser(), None


# [ahmed] Parse each cookie separately so duplicates cannot be overwritten.
def get_access_cookie(raw_header):
    token = None
    for part in raw_header.decode("latin-1").split(";"):
        part = part.strip()
        if not part or "=" not in part:
            return None
        cookie = SimpleCookie()
        try:
            cookie.load(part)
        except CookieError:
            return None
        if len(cookie) != 1:
            return None
        if "ws_access" in cookie:
            if token is not None:
                return None
            token = cookie["ws_access"].value
    # [ahmed] Accept only compact signed JWT syntax; reject empty values.
    compact_jwt = r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"
    if token and re.fullmatch(compact_jwt, token):
        return token
    return None


# [ahmed] Cookie issuance must set HttpOnly; incoming headers cannot prove it.
class JWTAuthMiddleware(BaseMiddleware):

    async def __call__(self, scope, receive, send):
        # [ahmed] Default to unauthenticated with no JWT expiration.
        scope["user"] = AnonymousUser()
        scope["jwt_exp"] = None

        # [ahmed] Reject ambiguous requests containing multiple Cookie headers.
        cookie_headers = [
            value
            for name, value in scope.get("headers", [])
            if name.lower() == b"cookie"
        ]

        if len(cookie_headers) == 1:
            token = get_access_cookie(cookie_headers[0])
            if token:
                # [ahmed] Give the consumer the verified user and expiry timestamp.
                scope["user"], scope["jwt_exp"] = await get_jwt_user(token)

        return await super().__call__(scope, receive, send)
